#!/bin/bash
cd "$(dirname "$0")"
echo "Starting AAZA site at http://localhost:8080"
echo "Press Ctrl+C to stop."
open "http://localhost:8080/vlogs.html"
python3 -m http.server 8080
