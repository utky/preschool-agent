# ベースイメージを指定
FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu

# noninteractiveに設定し、apt-getの実行時にプロンプトが出ないようにする
ENV DEBIAN_FRONTEND=noninteractive

# 必要なパッケージをインストール
RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates gnupg curl

# uv (Pythonのバージョン管理、パッケージ管理ツール) をインストール
# 別のイメージから実行ファイルをコピーしてくる
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# uv を使ってPython 3.12をインストール
RUN uv python install 3.12

# Google Cloud CLI をインストール
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor > /usr/share/keyrings/cloud.google.gpg && \
    apt-get update && \
    apt-get install -y google-cloud-cli

# DEBIAN_FRONTENDをリセット
ENV DEBIAN_FRONTEND=
