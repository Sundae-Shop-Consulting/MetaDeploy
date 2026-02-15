# Deploying MetaDeploy on AWS EC2 with Docker Compose

This guide covers deploying MetaDeploy on a single EC2 instance using Docker Compose. This is the simplest AWS deployment option, suitable for personal or small team use.

**Estimated cost:** ~$20-50/month (t3.small or t3.medium instance + storage)

## Prerequisites

Before starting, you'll need:

1. **AWS Account** with permissions to create EC2 instances, security groups, and optionally S3 buckets
2. **Domain name** (optional but recommended for HTTPS)
3. **GitHub Account** for creating a GitHub App
4. **Salesforce Org** for creating a Connected App

## Part 1: Create Required Apps

### 1.1 Create a GitHub App

1. Go to GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
2. Configure:
   - **GitHub App name:** `MetaDeploy-YourName` (must be unique)
   - **Homepage URL:** `https://your-domain.com/` (or placeholder for now)
   - **Webhook:** Uncheck "Active" (not needed)
   - **Repository permissions:** Contents → Read-only
   - **Where can this app be installed:** Only on this account
3. Click "Create GitHub App"
4. Note the **App ID** from the General settings page
5. Scroll down and click "Generate a private key" - save the `.pem` file securely
6. Install the app on your account, selecting the repositories you want MetaDeploy to access

### 1.2 Create a Salesforce External Client App

Salesforce is phasing out Connected Apps in favor of External Client Apps starting with Spring '26. If you have an existing Connected App it will continue to work, but new setups should use External Client Apps.

1. In Salesforce Setup, use Quick Find to search for **App Manager**
2. Click **New External Client App**
3. Fill in the basics:
   - **Name:** `MetaDeploy`
   - **Contact Email:** Your email
   - **Distribution State:** Local
4. Expand **Enable OAuth** and check the box to enable it
5. Set the **Callback URL:** `https://your-domain.com/accounts/salesforce/login/callback/`
   (use `http://YOUR_EC2_IP:8080/accounts/salesforce/login/callback/` if no domain yet).
   If you haven't set up your EC2 instance yet, you can use `https://localhost:8080/accounts/salesforce/login/callback/` as a placeholder — Salesforce doesn't validate that the URL resolves, but it does require a fully-formed URL. Remember to update it to your real URL before attempting to log in through MetaDeploy.
6. Add these **OAuth Scopes:**
   - Full access (full)
   - Perform requests at any time (refresh_token, offline_access)
   - Manage user data via web browsers (web)
7. Under security settings:
   - **Deselect** "Require Proof Key for Code Exchange (PKCE)" — MetaDeploy does not currently send PKCE parameters in its OAuth flow, so this must be unchecked or authentication will fail. (See [Future improvement: PKCE support](#future-improvement-pkce-support) below.)
   - **Select** "Require Secret for the Web Server Flow"
   - **Select** "Require Secret for Refresh Token Flow"
8. Save and wait 2-10 minutes for propagation
9. To get your credentials: from the **External Client Apps Manager**, click the dropdown next to your app, select **Edit Settings**, expand the **OAuth Settings** section, and click **Consumer Key and Secret**
10. Note the **Consumer Key** and **Consumer Secret**

## Part 2: Launch EC2 Instance

### 2.1 Create Security Group

In AWS Console → EC2 → Security Groups → Create security group:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Your IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | 8080 | 0.0.0.0/0 | Django dev server (optional, for testing) |

### 2.2 Launch Instance

1. Go to EC2 → Launch Instance
2. Configure:
   - **Name:** `metadeploy`
   - **AMI:** Ubuntu Server 24.04 LTS (or latest LTS)
   - **Instance type:** `t3.small` (2 vCPU, 2 GB RAM) minimum, `t3.medium` recommended
   - **Key pair:** Create or select existing
   - **Security group:** Select the one created above
   - **Storage:** 30 GB gp3 (minimum)
3. Launch and note the public IP address

### 2.3 Allocate Elastic IP (Recommended)

1. Go to EC2 → Elastic IPs → Allocate Elastic IP address
2. Associate it with your instance
3. This gives you a stable IP that persists across instance stops

## Part 3: Configure the Server

SSH into your instance:

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 3.1 Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Log out and back in for group changes to take effect
exit
```

SSH back in:

```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 3.2 Clone MetaDeploy

```bash
git clone https://github.com/SFDO-Tooling/MetaDeploy.git
cd MetaDeploy
```

If using your own fork:
```bash
git clone https://github.com/YOUR_USERNAME/MetaDeploy.git
cd MetaDeploy
```

### 3.3 Create Production Docker Compose File

Create a production-specific compose file:

```bash
cat > docker-compose.prod.yml << 'EOF'
version: '3'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: metadeploy
      POSTGRES_USER: metadeploy
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILD_ENV: production
        OMNIOUT_TOKEN: ""
        PROD_ASSETS: "true"
        OMNIOUT_TOKEN: ""  # Empty token to skip omnistudio dependency
    command: >
      bash -c "
        while ! nc -z postgres 5432; do sleep 1; done;
        python manage.py migrate --noinput &&
        daphne --bind 0.0.0.0 --port 8080 metadeploy.asgi:application
      "
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.production
      DATABASE_URL: postgres://metadeploy:${DB_PASSWORD}@postgres:5432/metadeploy
      REDIS_URL: redis://redis:6379
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY}
      DJANGO_HASHID_SALT: ${DJANGO_HASHID_SALT}
      DJANGO_ALLOWED_HOSTS: ${DJANGO_ALLOWED_HOSTS}
      DB_ENCRYPTION_KEY: ${DB_ENCRYPTION_KEY}
      SFDX_CLIENT_ID: ${SFDX_CLIENT_ID}
      SFDX_CLIENT_SECRET: ${SFDX_CLIENT_SECRET}
      SFDX_CLIENT_CALLBACK_URL: ${SFDX_CLIENT_CALLBACK_URL}
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_KEY: ${GITHUB_APP_KEY}
      SECURE_SSL_REDIRECT: ${SECURE_SSL_REDIRECT:-False}
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILD_ENV: production
        OMNIOUT_TOKEN: ""
    command: python manage.py rqworker default short
    depends_on:
      - postgres
      - redis
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.production
      DATABASE_URL: postgres://metadeploy:${DB_PASSWORD}@postgres:5432/metadeploy
      REDIS_URL: redis://redis:6379
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY}
      DJANGO_HASHID_SALT: ${DJANGO_HASHID_SALT}
      DB_ENCRYPTION_KEY: ${DB_ENCRYPTION_KEY}
      SFDX_CLIENT_ID: ${SFDX_CLIENT_ID}
      SFDX_CLIENT_SECRET: ${SFDX_CLIENT_SECRET}
      SFDX_CLIENT_CALLBACK_URL: ${SFDX_CLIENT_CALLBACK_URL}
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_KEY: ${GITHUB_APP_KEY}
    restart: always

  scheduler:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BUILD_ENV: production
        OMNIOUT_TOKEN: ""
    command: python manage.py metadeploy_rqscheduler
    depends_on:
      - postgres
      - redis
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.production
      DATABASE_URL: postgres://metadeploy:${DB_PASSWORD}@postgres:5432/metadeploy
      REDIS_URL: redis://redis:6379
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY}
      DJANGO_HASHID_SALT: ${DJANGO_HASHID_SALT}
      DB_ENCRYPTION_KEY: ${DB_ENCRYPTION_KEY}
      SFDX_CLIENT_ID: ${SFDX_CLIENT_ID}
      SFDX_CLIENT_SECRET: ${SFDX_CLIENT_SECRET}
      SFDX_CLIENT_CALLBACK_URL: ${SFDX_CLIENT_CALLBACK_URL}
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_APP_KEY: ${GITHUB_APP_KEY}
    restart: always

volumes:
  postgres_data:
EOF
```

### 3.4 Create Environment File

Generate required secrets:

```bash
# Generate secrets
DJANGO_SECRET=$(openssl rand -base64 32)
HASHID_SALT=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
DB_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || openssl rand -base64 32)

echo "Generated secrets:"
echo "DJANGO_SECRET_KEY: $DJANGO_SECRET"
echo "DJANGO_HASHID_SALT: $HASHID_SALT"
echo "DB_PASSWORD: $DB_PASSWORD"
echo "DB_ENCRYPTION_KEY: $DB_ENCRYPTION_KEY"
```

Create the `.env` file (replace placeholders with your values):

```bash
cat > .env << EOF
# Database
DB_PASSWORD=YOUR_GENERATED_DB_PASSWORD

# Django
DJANGO_SECRET_KEY=YOUR_GENERATED_SECRET
DJANGO_HASHID_SALT=YOUR_GENERATED_SALT
DJANGO_ALLOWED_HOSTS=YOUR_DOMAIN_OR_IP
DB_ENCRYPTION_KEY=YOUR_GENERATED_ENCRYPTION_KEY

# Salesforce Connected App
SFDX_CLIENT_ID=YOUR_CONSUMER_KEY
SFDX_CLIENT_SECRET=YOUR_CONSUMER_SECRET
SFDX_CLIENT_CALLBACK_URL=https://YOUR_DOMAIN/accounts/salesforce/login/callback/

# GitHub App
GITHUB_APP_ID=YOUR_APP_ID
GITHUB_APP_KEY="-----BEGIN RSA PRIVATE KEY-----
PASTE_YOUR_ENTIRE_PRIVATE_KEY_HERE
-----END RSA PRIVATE KEY-----"

# SSL (set to True once you have HTTPS configured)
SECURE_SSL_REDIRECT=False
EOF
```

Secure the file:
```bash
chmod 600 .env
```

### 3.5 Build and Start

```bash
# Build the containers (this takes 10-15 minutes first time)
docker compose -f docker-compose.prod.yml build

# Start the services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 3.6 Create Admin User

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py createsuperuser
```

## Part 4: Set Up HTTPS (Recommended)

### Option A: Using Caddy (Simplest)

Caddy automatically handles SSL certificates via Let's Encrypt.

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy
sudo tee /etc/caddy/Caddyfile << EOF
your-domain.com {
    reverse_proxy localhost:8080
}
EOF

# Restart Caddy
sudo systemctl restart caddy
```

After HTTPS is working, update `.env`:
```bash
SECURE_SSL_REDIRECT=True
SFDX_CLIENT_CALLBACK_URL=https://your-domain.com/accounts/salesforce/login/callback/
```

Then restart the services:
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Option B: Using nginx + Certbot

```bash
# Install nginx and certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Configure nginx
sudo tee /etc/nginx/sites-available/metadeploy << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/metadeploy /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Part 5: Maintenance

### View Logs
```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker
```

### Restart Services
```bash
docker compose -f docker-compose.prod.yml restart
```

### Update MetaDeploy
```bash
cd ~/MetaDeploy
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Backup Database
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U metadeploy metadeploy > backup_$(date +%Y%m%d).sql
```

### Start on Boot

Create a systemd service:

```bash
sudo tee /etc/systemd/system/metadeploy.service << EOF
[Unit]
Description=MetaDeploy Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/MetaDeploy
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable metadeploy
```

## Troubleshooting

### Container won't start
```bash
docker compose -f docker-compose.prod.yml logs web
```

### Database connection issues
```bash
# Check if postgres is running
docker compose -f docker-compose.prod.yml ps

# Check postgres logs
docker compose -f docker-compose.prod.yml logs postgres
```

### WebSocket connection issues
Ensure your reverse proxy (Caddy/nginx) is configured to handle WebSocket upgrades. The nginx config above includes the necessary headers.

### "CSRF verification failed" errors
Make sure `DJANGO_ALLOWED_HOSTS` includes your domain and that your callback URLs match exactly.

## Optional: S3 for Media Storage

If you want to store uploaded images in S3 instead of the database:

1. Create an S3 bucket in AWS
2. Create an IAM user with S3 access
3. Add to your `.env`:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your-bucket-name
```

4. Add these environment variables to the web service in `docker-compose.prod.yml`

## Future improvement: PKCE support

MetaDeploy uses django-allauth (v0.60.1) for Salesforce OAuth. Allauth supports PKCE as of v0.52.0, but MetaDeploy does not currently enable it. Adding PKCE support would allow enabling the "Require PKCE" setting on the External Client App, which is a security best practice for OAuth 2.0 authorization code flows.

The change would be a one-line addition to `SOCIALACCOUNT_PROVIDERS` in `config/settings/base.py`:

```python
SOCIALACCOUNT_PROVIDERS = {
    "salesforce": {
        "SCOPE": ["web", "full", "refresh_token"],
        "OAUTH_PKCE_ENABLED": True,  # Add this
        "APP": {
            "client_id": SFDX_CLIENT_ID,
            "secret": SFDX_CLIENT_SECRET,
        },
    },
}
```

Until this is implemented, "Require PKCE" must remain unchecked on the External Client App.
