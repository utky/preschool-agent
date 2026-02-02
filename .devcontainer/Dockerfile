# ベースイメージを指定
FROM mcr.microsoft.com/devcontainers/typescript-node

# noninteractiveに設定し、apt-getの実行時にプロンプトが出ないようにする
ENV DEBIAN_FRONTEND=noninteractive

# 必要なパッケージをインストール
RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates gnupg curl

# Google Cloud CLI をインストール
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor > /usr/share/keyrings/cloud.google.gpg && \
    apt-get update && \
    apt-get install -y google-cloud-cli

# npmのグローバルパッケージのインストール先を変更
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

# DEBIAN_FRONTENDをリセット
ENV DEBIAN_FRONTEND=

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
