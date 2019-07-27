#!/bin/bash

pwd
whoami
cd /home/centos/webapp
if [ -d "var" ] 
then
    echo "Directory /home/centos/webapp/var exists." 
else
    sudo mkdir -p var
fi

if [ -d "logs" ] 
then
    echo "Directory /home/centos/webapp/logs exists." 
else
    sudo mkdir -p logs
    sudo touch logs/webapp.log
    sudo chmod 666 logs/webapp.log
fi

sudo cp /var/.env /home/centos/webapp/var
sudo chmod 777 .env
pwd
sudo pm2 kill
sudo pm2 -f start index.js
