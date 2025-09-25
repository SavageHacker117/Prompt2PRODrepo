# Prompt2PROD (Examples)

A small, public-safe set of **example apps and docs**.

## Structure
- \pps/network-traffic\ — Flask API + HTML dashboard example
- \docs\ — repo documentation & PDFs
- \ssets/images\ — screenshots and images
- \scripts\ — helper scripts (dev shortcuts, etc.)

## Quick start (network-traffic)
\\\ash
cd apps/network-traffic
python -m venv .venv && source .venv/bin/activate
pip install flask flask-cors psutil pyyaml
./dashboard.sh
# open http://localhost:8080/dashboard.html
\\\

## Notes
- All files are sanitized for public sharing.
- Add more examples under \pps/\ as you like.