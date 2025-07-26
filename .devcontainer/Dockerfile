FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# gcloud CLI をインストール
RUN sudo apt-get update && \
  sudo apt-get install -y apt-transport-https ca-certificates gnupg curl && \
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
  sudo apt-get update && sudo apt-get install -y google-cloud-cli
