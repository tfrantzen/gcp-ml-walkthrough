# Google Cloud ML Walkthrough Demo

## Pre-Requisites
1. Need a GCP Account

## Setup
1. Create GCP Project
1. Activate Google Cloud Shell
1. Set your session to the current project
```
gcloud config set project <PROJECT NAME>
```
1. Enable Compute Engine, Vision, Speech, Translate, and Natural Language APIs
```
 gcloud services enable compute.googleapis.com
 gcloud services enable vision.googleapis.com
 gcloud services enable speech.googleapis.com
 gcloud services enable translate.googleapis.com
 gcloud services enable language.googleapis.com
 gcloud services enable vision.googleapis.com
```
1. Create an [API key](https://cloud.google.com/docs/authentication/api-keys)
1. Create a micro GCE instance
```
gcloud beta compute --project=$(gcloud config get-value project) instances create speech-client --zone=us-east1-b --machine-type=f1-micro --subnet=default --network-tier=PREMIUM --maintenance-policy=MIGRATE --service-account=430182276482-compute@developer.gserviceaccount.com --scopes=https://www.googleapis.com/auth/cloud-platform --tags=https-server --image=debian-9-drawfork-v20180423 --image-project=eip-images --boot-disk-size=10GB --boot-disk-type=pd-standard --boot-disk-device-name=speech-client
```
1. SSH into [New Instance](http://console.cloud.google.com/compute/instances)
1. Install git
```
sudo apt-get update
sudo apt-get install -y maven openjdk-8-jdk git
```
1. In order to access speech client, you will need to open a port in the Firewall
```
gcloud compute firewall-rules create dev-ports --allow=tcp:8443 --source-ranges=0.0.0.0/0
```
1. Clone this project
```
git clone https://github.com/tfrantzen/gcp-ml-walkthrough.git
```
1. Open directory
```
cd gcp-ml-walkthrough\streaming-client
```
1. Deploy application
```
mvn clean jetty:run
```
1. Open the Google Cloud Shell
1. Clone project
```
git clone https://github.com/tfrantzen/gcp-ml-walkthrough.git
```
1. Install dependencies
```
npm install
```
1. Collect GCE IP Address and API Key
1. Edit app.js, update variables
1. Deploy application
```
npm start
```
1. Open the web preview
	- You will need to navigate your speech-client GCE instance first to accept the self signed certificat
