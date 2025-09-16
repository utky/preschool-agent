#!/bin/sh
# npmでGemini CLIをインストール
npm install -g '@google/gemini-cli'

# gcloud認証
gcloud auth login --no-launch-browser
gcloud auth application-default login --no-launch-browser

# tofu
LATEST_VERSION=$(curl https://api.github.com/repos/sigstore/cosign/releases/latest | jq -r .tag_name | tr -d "v")
curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign_${LATEST_VERSION}_amd64.deb"
sudo dpkg -i cosign_${LATEST_VERSION}_amd64.deb
LATEST_VERSION=$(curl --silent https://api.github.com/repos/tofuutils/tenv/releases/latest | jq -r .tag_name)
curl -O -L "https://github.com/tofuutils/tenv/releases/latest/download/tenv_${LATEST_VERSION}_amd64.deb"
sudo dpkg -i "tenv_${LATEST_VERSION}_amd64.deb"

rm cosign_${LATEST_VERSION}_amd64.deb
rm "tenv_${LATEST_VERSION}_amd64.deb"

tenv completion bash > ~/.tenv.completion.bash
echo "source \$HOME/.tenv.completion.bash" >> ~/.bashrc

tenv tofu install
