echo "Enter the stack you want to create"
read stackName

echo "Enter Bucket Name for Code Deploy"
read codedeploybucket

dir_var=$(pwd)
echo "Current Directory is '$dir_var'"
file_dir_var="file://$dir_var/csye6225-aws-cf-labmda.json"

#create Stack
stackId=$(aws cloudformation create-stack --stack-name $stackName --template-body $file_dir_var --capabilities CAPABILITY_NAMED_IAM --parameters ParameterKey="codedeploybucket",ParameterValue=$codedeploybucket --output text)

echo "Stack ID : '$stackId'"

aws cloudformation wait stack-create-complete --stack-name $stackId
echo $stackId

if [ -z $stackId ]; then
	echo 'Error. Stack creation failed !!!'
		exit 1
	else
		echo "Stack Creation Done !!!"
fi
