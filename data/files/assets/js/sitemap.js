/* SITEMAP - single source of truth for navigation. Paths are relative to the site root.
   Levels: 1 = Kid (analogy), 2 = Beginner, 3 = Intermediate, 4 = Advanced, 5 = Interview-ready */
window.SITEMAP = {
  title: "SDE Prep Dojo",
  tagline: "Complete SDE-1 & SDE-2 interview prep - from 1st grade to FAANG offer",
  sections: [
    {
      id: "start", title: "Start Here", icon: "🏁", color: "#64748b",
      pages: [
        { id: "home", title: "Home & Learning Path", file: "index.html", level: 1, mins: 5 },
        { id: "study-plan", title: "8-Week Study Plan", file: "interview/study-plan.html", level: 1, mins: 10 },
        { id: "glossary", title: "Glossary (A-Z)", file: "glossary.html", level: 1, mins: 15 },
        { id: "resources", title: "Best Resources", file: "resources.html", level: 1, mins: 10 }
      ]
    },
    {
      id: "docker", title: "Docker", icon: "🐳", color: "#2496ed",
      pages: [
        { id: "docker-index", title: "Docker Track Overview", file: "docker/index.html", level: 1, mins: 5 },
        { id: "docker-01", title: "What is a Container?", file: "docker/01-what-is-a-container.html", level: 1, mins: 40 },
        { id: "docker-02", title: "Images & Layers", file: "docker/02-images-and-layers.html", level: 2, mins: 25 },
        { id: "docker-03", title: "Writing a Dockerfile", file: "docker/03-dockerfile.html", level: 2, mins: 30 },
        { id: "docker-04", title: "Running & Managing Containers", file: "docker/04-run-and-manage.html", level: 2, mins: 25 },
        { id: "docker-05", title: "Docker Networking", file: "docker/05-networking.html", level: 3, mins: 30 },
        { id: "docker-06", title: "Volumes & Storage", file: "docker/06-volumes-storage.html", level: 3, mins: 20 },
        { id: "docker-07", title: "Docker Compose", file: "docker/07-compose.html", level: 3, mins: 25 },
        { id: "docker-08", title: "Internals: Namespaces, cgroups, OverlayFS", file: "docker/08-internals.html", level: 4, mins: 40 },
        { id: "docker-09", title: "Production, Security & CI", file: "docker/09-production-security.html", level: 4, mins: 30 },
        { id: "docker-10", title: "Docker Interview Questions", file: "docker/10-interview.html", level: 5, mins: 45 }
      ]
    },
    {
      id: "k8s", title: "Kubernetes", icon: "☸️", color: "#326ce5",
      pages: [
        { id: "k8s-index", title: "Kubernetes Track Overview", file: "k8s/index.html", level: 1, mins: 5 },
        { id: "k8s-01", title: "Why Kubernetes?", file: "k8s/01-why-kubernetes.html", level: 1, mins: 20 },
        { id: "k8s-02", title: "Architecture: Control Plane & Nodes", file: "k8s/02-architecture.html", level: 2, mins: 35 },
        { id: "k8s-03", title: "Pods", file: "k8s/03-pods.html", level: 2, mins: 25 },
        { id: "k8s-04", title: "Deployments, ReplicaSets & Rollouts", file: "k8s/04-deployments.html", level: 2, mins: 30 },
        { id: "k8s-05", title: "Services & Cluster Networking", file: "k8s/05-services-networking.html", level: 3, mins: 40 },
        { id: "k8s-06", title: "Ingress & Gateway API", file: "k8s/06-ingress-gateway.html", level: 3, mins: 25 },
        { id: "k8s-07", title: "ConfigMaps & Secrets", file: "k8s/07-config-secrets.html", level: 3, mins: 20 },
        { id: "k8s-08", title: "Storage: PV, PVC, StorageClass", file: "k8s/08-storage.html", level: 3, mins: 25 },
        { id: "k8s-09", title: "Scheduling & Autoscaling", file: "k8s/09-scheduling-autoscaling.html", level: 4, mins: 35 },
        { id: "k8s-10", title: "StatefulSets, CRDs & Operators", file: "k8s/10-statefulsets-operators.html", level: 4, mins: 30 },
        { id: "k8s-11", title: "Observability & Troubleshooting", file: "k8s/11-observability-troubleshooting.html", level: 4, mins: 35 },
        { id: "k8s-12", title: "Security & RBAC", file: "k8s/12-security-rbac.html", level: 4, mins: 25 },
        { id: "k8s-13", title: "Kubernetes Interview Questions", file: "k8s/13-interview.html", level: 5, mins: 45 }
      ]
    },
    {
      id: "kafka", title: "Kafka", icon: "📨", color: "#e4572e",
      pages: [
        { id: "kafka-index", title: "Kafka Track Overview", file: "kafka/index.html", level: 1, mins: 15 },
        { id: "kafka-01", title: "Why Messaging? (Sync vs Async)", file: "kafka/01-why-messaging.html", level: 1, mins: 20 },
        { id: "kafka-02", title: "Core Concepts: Topics, Partitions, Offsets", file: "kafka/02-core-concepts.html", level: 2, mins: 35 },
        { id: "kafka-03", title: "Producers", file: "kafka/03-producers.html", level: 2, mins: 30 },
        { id: "kafka-04", title: "Consumers & Consumer Groups", file: "kafka/04-consumers-groups.html", level: 3, mins: 35 },
        { id: "kafka-05", title: "Replication & ISR", file: "kafka/05-replication.html", level: 3, mins: 30 },
        { id: "kafka-06", title: "Delivery Semantics & Exactly-Once", file: "kafka/06-delivery-semantics.html", level: 4, mins: 35 },
        { id: "kafka-07", title: "Storage Internals & Performance Secrets", file: "kafka/07-storage-internals.html", level: 4, mins: 35 },
        { id: "kafka-08", title: "KRaft, Controllers & Cluster Metadata", file: "kafka/08-kraft-cluster.html", level: 4, mins: 25 },
        { id: "kafka-09", title: "Kafka Connect, Streams & Flink", file: "kafka/09-connect-streams.html", level: 4, mins: 35 },
        { id: "kafka-10", title: "Schemas & Schema Registry", file: "kafka/10-schema-registry.html", level: 4, mins: 20 },
        { id: "kafka-11", title: "Operations, Tuning & Kafka on K8s", file: "kafka/11-performance-ops.html", level: 5, mins: 35 },
        { id: "kafka-12", title: "Kafka vs RabbitMQ vs SQS vs Pulsar", file: "kafka/12-kafka-vs-others.html", level: 4, mins: 20 },
        { id: "kafka-13", title: "Kafka Interview Questions", file: "kafka/13-interview.html", level: 5, mins: 45 }
      ]
    },
    {
      id: "pipeline", title: "End-to-End Kafka Pipeline", icon: "🛠️", color: "#16a34a",
      pages: [
        { id: "pipeline-index", title: "Project Overview: ShopStream", file: "pipeline/index.html", level: 2, mins: 15 },
        { id: "pipeline-01", title: "Pipeline Architecture", file: "pipeline/01-architecture.html", level: 3, mins: 45 },
        { id: "pipeline-02", title: "Build It Locally (Docker Compose)", file: "pipeline/02-build-locally.html", level: 3, mins: 75 },
        { id: "pipeline-03", title: "Stream Processing, Retries & DLQ", file: "pipeline/03-stream-processing.html", level: 4, mins: 60 },
        { id: "pipeline-04", title: "Deploy on Kubernetes (Strimzi)", file: "pipeline/04-deploy-on-k8s.html", level: 4, mins: 70 },
        { id: "pipeline-05", title: "Observability & Failure Drills", file: "pipeline/05-observability-failures.html", level: 5, mins: 60 }
      ]
    },
    {
      id: "hld", title: "System Design (HLD)", icon: "🏗️", color: "#7c3aed",
      pages: [
        { id: "hld-index", title: "HLD Overview & Design Gallery", file: "hld/index.html", level: 1, mins: 25 },
        { id: "hld-01", title: "Fundamentals: Scale, Cache, DB, CAP", file: "hld/01-fundamentals.html", level: 2, mins: 60 },
        { id: "hld-02", title: "Distributed Building Blocks", file: "hld/02-building-blocks.html", level: 4, mins: 60 },
        { id: "hld-03", title: "The 45-Minute Interview Framework", file: "hld/03-interview-framework.html", level: 3, mins: 25 },
        { id: "hld-04", title: "Back-of-Envelope Estimation", file: "hld/04-estimation.html", level: 3, mins: 30 },
        { id: "hld-05", title: "Networking for HLD: DNS, Proxies, LBs & API Gateways", file: "hld/05-networking-proxies-gateways.html", level: 2, mins: 40 },
        { id: "hld-06", title: "API Design & Client-Server Communication", file: "hld/06-api-design-communication.html", level: 3, mins: 45 },
        { id: "hld-07", title: "Data Modeling, Indexing & Storage Engines", file: "hld/07-data-modeling-indexing.html", level: 3, mins: 45 },
        { id: "hld-08", title: "Choosing Storage: DB Types & Key Technologies", file: "hld/08-choosing-storage.html", level: 3, mins: 45 },
        { id: "hld-09", title: "Replication, Consensus & Coordination", file: "hld/09-coordination-consensus.html", level: 5, mins: 50 },
        { id: "hld-10", title: "Distributed Transactions & Event-Driven Data", file: "hld/10-distributed-transactions-events.html", level: 4, mins: 45 },
        { id: "hld-11", title: "Microservices & Resilience Patterns", file: "hld/11-microservices-resilience.html", level: 4, mins: 45 },
        { id: "hld-12", title: "Big Data: Batch, Streaming & Probabilistic Structures", file: "hld/12-big-data-streaming.html", level: 4, mins: 45 },
        { id: "hld-13", title: "Reliability at Scale: SLOs, Multi-Region & DR", file: "hld/13-reliability-multiregion-dr.html", level: 4, mins: 55 },
        { id: "hld-14", title: "Security & Identity in System Design", file: "hld/14-security-identity.html", level: 3, mins: 55 },
        { id: "hld-15", title: "Geospatial, Text & Prefix Indexes", file: "hld/15-geo-and-specialized-indexes.html", level: 4, mins: 55 },
        { id: "hld-16", title: "HLD vs LLD: Handling Combined Design Rounds", file: "hld/16-hld-vs-lld.html", level: 3, mins: 40 },
        { id: "hld-17", title: "AI/LLM System Building Blocks", file: "hld/17-ai-system-building-blocks.html", level: 4, mins: 55 }
      ]
    },
    {
      id: "designs", title: "75 Real-World Designs", icon: "🌍", color: "#db2777",
      pages: [
        { id: "d01", title: "URL Shortener (TinyURL)", file: "hld/designs/url-shortener.html", level: 3, mins: 30 },
        { id: "d02", title: "Distributed Rate Limiter", file: "hld/designs/rate-limiter.html", level: 3, mins: 30 },
        { id: "d03", title: "Notification System", file: "hld/designs/notification-system.html", level: 3, mins: 30 },
        { id: "d04", title: "Chat App (WhatsApp)", file: "hld/designs/chat-whatsapp.html", level: 4, mins: 40 },
        { id: "d05", title: "News Feed (Instagram/Facebook)", file: "hld/designs/news-feed.html", level: 4, mins: 40 },
        { id: "d06", title: "Ride Hailing (Uber/Ola)", file: "hld/designs/ride-hailing-uber.html", level: 4, mins: 40 },
        { id: "d07", title: "Food Delivery (Swiggy/Zomato)", file: "hld/designs/food-delivery.html", level: 4, mins: 40 },
        { id: "d08", title: "E-commerce Checkout (Amazon)", file: "hld/designs/ecommerce-checkout.html", level: 4, mins: 40 },
        { id: "d09", title: "Flash Sale (Flipkart Big Billion Days)", file: "hld/designs/flash-sale.html", level: 5, mins: 40 },
        { id: "d10", title: "Payment System", file: "hld/designs/payment-system.html", level: 5, mins: 40 },
        { id: "d11", title: "Inventory Management (Walmart)", file: "hld/designs/inventory-walmart.html", level: 4, mins: 35 },
        { id: "d12", title: "Video Streaming (Netflix)", file: "hld/designs/video-streaming-netflix.html", level: 4, mins: 40 },
        { id: "d13", title: "Video Upload & Transcoding (YouTube)", file: "hld/designs/youtube-upload.html", level: 4, mins: 35 },
        { id: "d14", title: "Ticket Booking (BookMyShow)", file: "hld/designs/ticket-booking.html", level: 4, mins: 35 },
        { id: "d15", title: "Search Autocomplete", file: "hld/designs/search-autocomplete.html", level: 3, mins: 30 },
        { id: "d16", title: "Web Crawler", file: "hld/designs/web-crawler.html", level: 4, mins: 35 },
        { id: "d17", title: "Distributed Cache (Redis-like)", file: "hld/designs/distributed-cache.html", level: 4, mins: 35 },
        { id: "d18", title: "Design a Message Queue (Kafka itself)", file: "hld/designs/message-queue.html", level: 5, mins: 40 },
        { id: "d19", title: "Log Aggregation (ELK at scale)", file: "hld/designs/log-aggregation.html", level: 4, mins: 30 },
        { id: "d20", title: "Metrics & Monitoring (Prometheus-like)", file: "hld/designs/metrics-monitoring.html", level: 4, mins: 35 },
        { id: "d21", title: "Ad Click Aggregator", file: "hld/designs/ad-click-aggregator.html", level: 5, mins: 35 },
        { id: "d22", title: "Real-time Leaderboard", file: "hld/designs/leaderboard.html", level: 3, mins: 25 },
        { id: "d23", title: "Collaborative Editor (Google Docs)", file: "hld/designs/collaborative-editor.html", level: 5, mins: 40 },
        { id: "d24", title: "File Sync (Dropbox/OneDrive)", file: "hld/designs/file-sync-dropbox.html", level: 4, mins: 35 },
        { id: "d25", title: "Distributed Job Scheduler", file: "hld/designs/job-scheduler.html", level: 4, mins: 35 },
        { id: "d26", title: "Stock Exchange / Order Matching", file: "hld/designs/stock-exchange.html", level: 5, mins: 40 },
        { id: "d27", title: "Real-time Fraud Detection", file: "hld/designs/fraud-detection.html", level: 5, mins: 35 },
        { id: "d28", title: "CDC Data Pipeline (Debezium to Lake)", file: "hld/designs/cdc-pipeline.html", level: 4, mins: 35 },
        { id: "d29", title: "Trending Topics (Twitter/X)", file: "hld/designs/trending-topics.html", level: 4, mins: 30 },
        { id: "d30", title: "CI/CD Platform on Kubernetes", file: "hld/designs/cicd-platform.html", level: 4, mins: 35 },
        { id: "d31", title: "Distributed Unique ID Generator (Snowflake)", file: "hld/designs/unique-id-generator.html", level: 3, mins: 25 },
        { id: "d32", title: "Distributed Key-Value Store (Dynamo)", file: "hld/designs/key-value-store.html", level: 5, mins: 45 },
        { id: "d33", title: "Proximity Service & Nearby Friends (Yelp)", file: "hld/designs/proximity-yelp.html", level: 4, mins: 35 },
        { id: "d34", title: "Online Judge / Coding Platform (LeetCode)", file: "hld/designs/online-judge-leetcode.html", level: 4, mins: 35 },
        { id: "d35", title: "Top-K / Heavy Hitters", file: "hld/designs/top-k-heavy-hitters.html", level: 4, mins: 35 },
        { id: "d36", title: "S3-like Object Storage", file: "hld/designs/s3-object-storage.html", level: 5, mins: 40 },
        { id: "d37", title: "Google Maps (Routing & ETA)", file: "hld/designs/google-maps.html", level: 5, mins: 40 },
        { id: "d38", title: "Post Search (Twitter / Facebook Search)", file: "hld/designs/post-search.html", level: 4, mins: 35 },
        { id: "d39", title: "Distributed Counter (Likes / Views)", file: "hld/designs/distributed-counter.html", level: 3, mins: 25 },
        { id: "d40", title: "Hotel / Airbnb Reservation", file: "hld/designs/hotel-booking-airbnb.html", level: 4, mins: 35 },
        { id: "d41", title: "Digital Wallet, UPI & Double-Entry Ledger", file: "hld/designs/digital-wallet-ledger.html", level: 5, mins: 40 },
        { id: "d42", title: "Email Service (Gmail / Outlook)", file: "hld/designs/email-service.html", level: 4, mins: 35 },
        { id: "d43", title: "Calendar & Reminders (Google Calendar / Outlook)", file: "hld/designs/calendar-reminders.html", level: 3, mins: 30 },
        { id: "d44", title: "Live Comments & Reactions (FB Live / Hotstar)", file: "hld/designs/live-comments.html", level: 4, mins: 30 },
        { id: "d45", title: "Reddit / Quora (Q&A, Voting, Ranking)", file: "hld/designs/reddit-quora.html", level: 3, mins: 30 },
        { id: "d46", title: "Online Multiplayer Game (Chess)", file: "hld/designs/online-chess-game.html", level: 4, mins: 30 },
        { id: "d47", title: "ChatGPT-like LLM Serving", file: "hld/designs/chatgpt-llm-serving.html", level: 5, mins: 40 },
        { id: "d48", title: "Recommendation System (Amazon / Netflix)", file: "hld/designs/recommendation-system.html", level: 5, mins: 40 },
        { id: "d49", title: "Product Catalog, Search & Reviews (Flipkart)", file: "hld/designs/product-catalog-search.html", level: 4, mins: 35 },
        { id: "d50", title: "Surge Pricing & ETA (Uber)", file: "hld/designs/surge-pricing-eta.html", level: 5, mins: 35 },
        { id: "d51", title: "Team Chat with Channels & Presence (Slack / Teams)", file: "hld/designs/team-chat-slack-teams.html", level: 4, mins: 35 },
        { id: "d52", title: "Video Conferencing (Zoom / Teams Meetings)", file: "hld/designs/video-conferencing-zoom.html", level: 5, mins: 40 },
        { id: "d53", title: "Price Tracker & Alerts", file: "hld/designs/price-tracker-alerts.html", level: 3, mins: 25 },
        { id: "d54", title: "Amazon Locker / Store Pickup", file: "hld/designs/amazon-locker-pickup.html", level: 3, mins: 25 },
        { id: "d55", title: "Distributed Lock Service (Chubby / ZooKeeper)", file: "hld/designs/distributed-lock-service.html", level: 5, mins: 40 },
        { id: "d56", title: "Design a Load Balancer (L4/L7)", file: "hld/designs/load-balancer.html", level: 4, mins: 35 },
        { id: "d57", title: "Search Engine (Google Search)", file: "hld/designs/google-search.html", level: 5, mins: 40 },
        { id: "d58", title: "News Aggregator (Google News)", file: "hld/designs/news-aggregator.html", level: 3, mins: 25 },
        { id: "d59", title: "Dating App (Tinder)", file: "hld/designs/dating-app-tinder.html", level: 3, mins: 25 },
        { id: "d60", title: "Authentication & SSO Service", file: "hld/designs/auth-sso-service.html", level: 4, mins: 35 },
        { id: "d61", title: "Music Streaming (Spotify / Amazon Music)", file: "hld/designs/music-streaming-spotify.html", level: 4, mins: 45 },
        { id: "d62", title: "Tagging System (Jira / Confluence Tags)", file: "hld/designs/tagging-system.html", level: 3, mins: 40 },
        { id: "d63", title: "Stock Price Alerts (Uber's Favourite)", file: "hld/designs/stock-price-alerts.html", level: 4, mins: 40 },
        { id: "d64", title: "Stock Broker App (Zerodha / Groww)", file: "hld/designs/stock-broker-app.html", level: 5, mins: 50 },
        { id: "d65", title: "Device Settings Sync & Backup/Restore (Alexa)", file: "hld/designs/device-sync-backup.html", level: 4, mins: 40 },
        { id: "d66", title: "Flight Search & Booking (MakeMyTrip / Skyscanner)", file: "hld/designs/flight-booking.html", level: 4, mins: 35 },
        { id: "d67", title: "Time-Slot Reservation (CoWIN / Rooms / Service Centres)", file: "hld/designs/slot-reservation.html", level: 3, mins: 50 },
        { id: "d68", title: "Quick Commerce (Blinkit / Zepto / Instamart)", file: "hld/designs/quick-commerce.html", level: 4, mins: 40 },
        { id: "d69", title: "Distributed Configuration Service", file: "hld/designs/config-service.html", level: 4, mins: 40 },
        { id: "d70", title: "IoT Telemetry & Real-time Heatmaps (Smart Meters / Drivers)", file: "hld/designs/iot-telemetry-heatmap.html", level: 4, mins: 50 },
        { id: "d71", title: "Recurring Subscriptions & Auto-Orders", file: "hld/designs/recurring-subscriptions.html", level: 3, mins: 45 },
        { id: "d72", title: "Online Auction (eBay-style Bidding)", file: "hld/designs/online-auction.html", level: 4, mins: 40 },
        { id: "d73", title: "Customer Support Chat & Agent Routing", file: "hld/designs/support-chat-routing.html", level: 4, mins: 40 },
        { id: "d74", title: "Document Upload & Async Processing", file: "hld/designs/document-processing.html", level: 3, mins: 35 },
        { id: "d75", title: "Live Streaming (Twitch / Live Cricket)", file: "hld/designs/live-streaming.html", level: 5, mins: 35 }
      ]
    },
    {
      id: "patterns", title: "HLD Patterns", icon: "🧩", color: "#0891b2",
      pages: [
        { id: "p01", title: "Pattern: Real-time Updates", file: "hld/patterns/real-time-updates.html", level: 3, mins: 30 },
        { id: "p02", title: "Pattern: Dealing with Contention", file: "hld/patterns/dealing-with-contention.html", level: 4, mins: 30 },
        { id: "p03", title: "Pattern: Multi-step Processes (Sagas & Workflows)", file: "hld/patterns/multi-step-processes.html", level: 4, mins: 30 },
        { id: "p04", title: "Pattern: Scaling Reads (and Caching Pitfalls)", file: "hld/patterns/scaling-reads.html", level: 3, mins: 45 },
        { id: "p05", title: "Pattern: Scaling Writes", file: "hld/patterns/scaling-writes.html", level: 4, mins: 30 },
        { id: "p06", title: "Pattern: Handling Large Blobs", file: "hld/patterns/handling-large-blobs.html", level: 3, mins: 25 },
        { id: "p07", title: "Pattern: Managing Long-running Tasks", file: "hld/patterns/long-running-tasks.html", level: 3, mins: 40 },
        { id: "p08", title: "Pattern: Fan-out (Push vs Pull)", file: "hld/patterns/fan-out-push-vs-pull.html", level: 3, mins: 25 },
        { id: "p09", title: "Pattern: Counting, Ranking & Windowed Aggregation", file: "hld/patterns/counting-and-aggregation.html", level: 4, mins: 30 },
        { id: "p10", title: "Pattern: Geo & Proximity Queries", file: "hld/patterns/geo-proximity.html", level: 4, mins: 45 }
      ]
    },
    {
      id: "interview", title: "Interview Hub", icon: "🎯", color: "#ca8a04",
      pages: [
        { id: "interview-index", title: "Interview Hub", file: "interview/index.html", level: 3, mins: 30 },
        { id: "question-bank", title: "Question Bank (filterable)", file: "interview/question-bank.html", level: 5, mins: 90 },
        { id: "recent-hld", title: "Recently Asked HLD Questions (mid-2024 to Nov 2026)", file: "interview/recent-hld-questions.html", level: 5, mins: 180 },
        { id: "scenarios", title: "Production Scenario Drills", file: "interview/scenarios.html", level: 5, mins: 60 },
        { id: "cheatsheets", title: "One-Page Cheat Sheets", file: "interview/cheatsheets.html", level: 4, mins: 20 },
        { id: "tracker", title: "Build Tracker", file: "tracker.html", level: 1, mins: 2 }
      ]
    },
    {
      id: "companies", title: "Company Guides", icon: "🏢", color: "#0f766e",
      pages: [
        { id: "co-amazon", title: "Amazon SDE-1/SDE-2 Guide", file: "interview/companies/amazon.html", level: 4, mins: 35 },
        { id: "co-microsoft", title: "Microsoft SDE-1/SDE-2 Guide", file: "interview/companies/microsoft.html", level: 4, mins: 30 },
        { id: "co-google", title: "Google L3/L4 Guide", file: "interview/companies/google.html", level: 4, mins: 20 },
        { id: "co-meta", title: "Meta E4/E5 Guide", file: "interview/companies/meta.html", level: 4, mins: 30 },
        { id: "co-uber", title: "Uber SDE-2 Guide", file: "interview/companies/uber.html", level: 4, mins: 30 },
        { id: "co-atlassian", title: "Atlassian P30/P40 Guide", file: "interview/companies/atlassian.html", level: 4, mins: 25 },
        { id: "co-flipkart", title: "Flipkart SDE-1/SDE-2 Guide", file: "interview/companies/flipkart.html", level: 4, mins: 30 },
        { id: "co-walmart", title: "Walmart Global Tech Guide", file: "interview/companies/walmart.html", level: 4, mins: 25 },
        { id: "co-salesforce", title: "Salesforce MTS/SMTS Guide", file: "interview/companies/salesforce.html", level: 4, mins: 25 },
        { id: "co-oracle-adobe", title: "Oracle & Adobe Guide", file: "interview/companies/oracle-adobe.html", level: 4, mins: 25 },
        { id: "co-fintech-india", title: "Indian Fintech Guide (PhonePe, Paytm, Razorpay, Groww, CRED)", file: "interview/companies/fintech-india.html", level: 4, mins: 35 },
        { id: "co-food-qcommerce", title: "Food & Quick-Commerce Guide (Zomato/Blinkit, Swiggy, Zepto)", file: "interview/companies/food-quick-commerce.html", level: 4, mins: 30 }
      ]
    }
  ]
};
