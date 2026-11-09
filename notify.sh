#!/usr/bin/env bash
MENSAJE="$1"
BOT_TOKEN="9171188861:AAFvS8AdsyfzkmmE4WczH65gnodj_tcFVic"
CHAT_ID="1294217077"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d text="${MENSAJE}" > /dev/null