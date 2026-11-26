# ShopStream on Kubernetes (kind + Strimzi + KEDA)

Versions checked in November 2026: kind v0.33.0, Strimzi 1.3.1 (API `kafka.strimzi.io/v1`, KRaft only,
needs Kubernetes 1.32+), Kafka 4.3.2, KEDA v2.21.1.

| File | What it creates |
|---|---|
| `kind-config.yaml` | local cluster: 1 control-plane + 3 workers labelled zone-a/b/c |
| `00-namespaces.yaml` | `kafka` (operator + cluster) and `shopstream` (apps) |
| `10-kafka-cluster.yaml` | 2 `KafkaNodePool`s (3 controllers, 3 brokers) + `Kafka` CR (KRaft, rack-aware, kafkaExporter) |
| `11-kafka-topics.yaml` | `KafkaTopic` CRs: orders.created/enriched (6 partitions), retry/dlq (3), RF 3, min ISR 2 |
| `20-config.yaml` | ConfigMap (non-secret settings) |
| `20-secret.example.yaml` | Secret **placeholder** (not in kustomization; apply it OR create your own) |
| `21-postgres.yaml` | demo Postgres StatefulSet + init SQL |
| `30-order-api.yaml` | Deployment (startup/liveness/readiness probes) + NodePort Service + HPA (CPU) + PDB |
| `31-enricher.yaml` | enricher Deployment + KEDA `ScaledObject` (scale on lag) + PDB + retry-worker |
| `32-sinks.yaml` | postgres-sink (2 replicas + PDB), analytics (1 replica, in-memory state) |
| `40-networkpolicy.yaml` | default-deny ingress, allow-lists for API, Postgres, metrics |
| `kustomization.yaml` | `kubectl apply -k k8s/` applies all of the above except the example Secret |

## Steps (run from `pipeline/code`)

```bash
# 0. Tools: docker, kubectl, kind (https://kind.sigs.k8s.io), optionally helm.
kind create cluster --config k8s/kind-config.yaml
kubectl get nodes                                  # 4 nodes Ready

# 1. Strimzi operator (watches namespace "kafka")
kubectl apply -f k8s/00-namespaces.yaml
kubectl create -f 'https://strimzi.io/install/latest?namespace=kafka' -n kafka
#   pinned alternative: download strimzi-cluster-operator-1.3.1.yaml from the GitHub release,
#   replace "namespace: myproject" with "namespace: kafka", then kubectl create -f it.
kubectl -n kafka rollout status deploy/strimzi-cluster-operator --timeout=300s

# 2. Kafka cluster + topics
kubectl apply -f k8s/10-kafka-cluster.yaml
kubectl -n kafka wait kafka/shopstream --for=condition=Ready --timeout=600s
kubectl apply -f k8s/11-kafka-topics.yaml
kubectl -n kafka get kafkatopics                   # READY=True for all four

# 3. KEDA (for the lag-based autoscaler)
kubectl apply --server-side -f https://github.com/kedacore/keda/releases/download/v2.21.1/keda-2.21.1.yaml
#   or: helm repo add kedacore https://kedacore.github.io/charts && helm install keda kedacore/keda -n keda --create-namespace
kubectl -n keda rollout status deploy/keda-operator

# 3b. metrics-server (for the CPU HPA of order-api). kind does not ship it, and kind's kubelets
#     use self-signed certs, so add --kubelet-insecure-tls (lab only, never in production).
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system patch deploy metrics-server --type=json   -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl -n kube-system rollout status deploy/metrics-server
kubectl top nodes                                  # numbers instead of an error = working

# 4. Our images: build locally, then copy them into the kind nodes (no registry needed)
docker compose build
for s in order-api enricher postgres-sink analytics; do kind load docker-image shopstream/$s:dev --name shopstream; done

# 5. Apps. Secret first: apply the example OR create your own (see 20-secret.example.yaml), never both.
kubectl apply -f k8s/20-secret.example.yaml
kubectl apply -f k8s/20-config.yaml -f k8s/21-postgres.yaml
kubectl apply -f k8s/30-order-api.yaml -f k8s/31-enricher.yaml -f k8s/32-sinks.yaml -f k8s/40-networkpolicy.yaml
kubectl -n shopstream get pods -w

# 6. Try it (NodePort 30080 is mapped to your host by kind-config.yaml)
curl -X POST localhost:30080/orders -H 'Content-Type: application/json' \
  -d '{"customer_id":"C-1","items":[{"product_id":"P-100","quantity":2}]}'
python loadgen/loadgen.py --url http://localhost:30080/orders --rps 50 --seconds 120
kubectl -n shopstream get hpa,scaledobject      # watch KEDA add enricher pods as lag grows

# 7. Clean up
kind delete cluster --name shopstream
```

Without step 3b, `kubectl get hpa` shows `TARGETS <unknown>/70%` and order-api never scales.

Monitoring is not deployed by these manifests. To get the Grafana view on kind, install
kube-prometheus-stack into a namespace called `monitoring` (the NetworkPolicy already allows it):
`helm repo add prometheus-community https://prometheus-community.github.io/helm-charts && helm install mon prometheus-community/kube-prometheus-stack -n monitoring --create-namespace`.
That chart finds targets through `PodMonitor`/`ServiceMonitor` objects, not the `prometheus.io/*`
annotations, so you would add a PodMonitor for port `http` of the shopstream pods and one for
Strimzi's kafkaExporter (it provides consumer lag). This is left as an exercise; it is not part of the lab.

## Things to notice (interview gold)

- **Two autoscalers, two signals.** order-api is stateless HTTP: CPU HPA. The enricher is a consumer:
  CPU can be low while work piles up, so KEDA scales on **consumer lag**. Max replicas = partitions (6).
- **No `replicas:` on autoscaled Deployments:** order-api (HPA) and enricher (KEDA) omit it, so `kubectl apply` does not reset the count.
- **PDB with 1 replica:** `minAvailable: 1` would block `kubectl drain` forever, so the enricher uses `maxUnavailable: 1`.
- **Secrets:** the Secret in `20-secret.example.yaml` is a placeholder, kept out of `kustomization.yaml`. Real clusters use External Secrets,
  Sealed Secrets or a cloud secret manager, plus TLS/SCRAM listeners and `KafkaUser` ACLs.
- **Rack awareness:** `rack.topologyKey` makes Strimzi place the 3 replicas of a partition in 3 zones.
