#!/bin/sh
# uvでツールをインストール
uv pip install ty ruff

# npmでGemini CLIをインストール
npm install -g '@google/gemini-cli'

# uv syncはpyproject.toml作成後に実行される想定
# uv sync

