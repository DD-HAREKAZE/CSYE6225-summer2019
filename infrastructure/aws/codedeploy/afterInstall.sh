#!/bin/bash

#sudo systemctl stop tomcat.service

#sudo rm -rf /opt/tomcat/webapps/docs  /opt/tomcat/webapps/examples /opt/tomcat/webapps/host-manager  /opt/tomcat/webapps/manager /opt/tomcat/webapps/ROOT

#sudo chown tomcat:tomcat /opt/tomcat/webapps/ROOT.war

# cleanup log files
#sudo rm -rf /opt/tomcat/logs/catalina*
#sudo rm -rf /opt/tomcat/logs/*.log
#sudo rm -rf /opt/tomcat/logs/*.txt
pwd

#su centos -c "aws configure set region us-east-1"
PATH=$PATH:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/centos/.local/bin:/home/centos/bin

echo $PATH

aws configure set default.region us-east-1

aws configure list

whoami

rdsEndpoint = `aws rds describe-db-instances --db-instance-identifier csye6225-su19 --query 'DBInstances[*].Endpoint.Address' --output text`
aws rds describe-db-instances --db-instance-identifier csye6225-su19 --query 'DBInstances[*].Endpoint.Address' --output text
#echo $rdsEndpoint

s3bucket = `aws s3api list-buckets --query "Buckets[].Name" --output text  | awk '{split($0,b," ");print b[1];print b[1]; print b[2]}' | grep '^csye6225'`
aws s3api list-buckets --query "Buckets[].Name" --output text  | awk '{split($0,b," ");print b[1];print b[1]; print b[2]}' | grep '^csye6225'
#echo $s3bucket

#aws s3api list-buckets --query "Buckets[].Name" --output text  | awk -F '[ ]' | grep "^csye6225" | awk '{print length($0)}'
#aws s3api list-buckets --query "Buckets[].Name" --output text  | awk '{split($0,b," ");print b[1];print b[1]; print b[2]}' | grep '^csye6225'

cd /home/centos/webapp/
pwd

sudo npm install

sudo npm i forever -g

#sudo NODE_ENV=prod NODE_DB_HOST=$rdsEndpoint NODE_S3_BUCKET=$s3bucket NODE_DB_USER=csye6225master NODE_DB_PASS=csye6225password forever start --minUptime 1000 --spinSleepTime 1000 index.js 
sudo NODE_ENV=prod NODE_DB_HOST=${rdsEndpoint} NODE_S3_BUCKET=${s3bucket} NODE_DB_USER=csye6225master NODE_DB_PASS=csye6225password forever start --minUptime 1000 --spinSleepTime 1000 index.js 

forever list
