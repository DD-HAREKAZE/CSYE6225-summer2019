aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE||CREATE_IN_PROGRESS||REVIEW_IN_PROGRESS||DELETE_IN_PROGRESS||DELETE_FAILED||UPDATE_IN_PROGRESS||DELETE_COMPLETE

echo "Enter the stack you want to create"
read Stack_Name

loadBalancerArn=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?LoadBalancerName==`csye6225LoadBalancer`].[LoadBalancerArn]' --output text)

dir_var=$(pwd)
file_dir_var="file://$dir_var/csye6225-firewall.json"

stackId=$(aws cloudformation create-stack --stack-name $Stack_Name --template-body $file_dir_var --parameters ParameterKey="loadBalancerArn",ParameterValue=$loadBalancerArn --disable-rollback)
echo "Stack ID : '$stackId'"

aws cloudformation wait stack-create-complete --stack-name $stackId
echo $stackId

if [ -z $stackId ]; then
	echo 'Error. Stack creation failed !!!'
		exit 1
	else
		echo "Stack Creation Done !!!"
	fi
