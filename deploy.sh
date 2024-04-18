#!/bin/bash

if [ -e "variables.tf" ]
then
  echo "File variables.tf exists in the current directory."
  sleep 3
else
  echo "File variables.tf does not exist in the current directory."
  echo "-------------------------------------------"
  echo ""
  echo 'variables.tf should look like the following:
        variable "region" {
          default = "us-east-1"
        }

        variable "OPENAI_API_KEY" {
          type    = string
          default = "ENTER_OPENAI_API_KEY_HERE"
        }
        
        variable "CLIENT_ID" {
          type = string
          default = "ENTER_CONNECTED_APP_KEY_HERE"
        }

        variable "CLIENT_SECRET" {
            type = string
            default = "ENTER_CONNECTED_APP_SECRET_HERE"
        }

        variable "SF_USERNAME" {
            type = string
            default = "ENTER_SF_USERNAME_HERE"
        }

        variable "SF_PASSWORD" {
            type = string
            default = "ENTER_SF_PW_HERE"
        }

        variable "SF_SECURITY_TOKEN" {
            type = string
            default = "ENTER_SF_SECURITY_TOKEN_HERE"
        }

        variable "SF_PATCH_URL" {
            type = string
            default = "ENTER_SF_PATCH_URL_HERE"
        }'
  exit 1
fi

if [[ $# -eq 1 ]]; then
  if [[ $1 == "terraform" ]]; then
    echo "Running Terraform deployment..."
    sleep 2
    terraform init
    sleep 2
    terraform apply
    echo "Deploy complete!! Now test your code!"
    exit 0
  else
    echo "Invalid input. Please provide 'terraform' as the input."
    exit 1
  fi
elif [[ $# -eq 2 ]]; then
  if [[ $1 == "terraform" ]]; then
    lambda_function_name=$2
    zip_filename="$lambda_function_name.zip"

    if [[ -f $zip_filename ]]; then
      echo "Existing zip file found: $zip_filename. Deleting it..."
      sleep 2
      rm $zip_filename
    fi

    echo "Creating a new zip file: $zip_filename..."
    sleep 2
    
    foldername=$2
    foldername="${foldername%/}"  # Remove trailing slash if present

    if [[ -d $foldername ]]; then
      zip_filename="${foldername}.zip"
      echo "Creating zip file: $zip_filename..."
      
      zip -r "$zip_filename" "$foldername"

      echo "Zip file created successfully."
    else
      echo "Folder '$foldername' does not exist."
      exit 1
    fi
    echo "Running Terraform deployment for Lambda function: $lambda_function_name"
    sleep 2
    terraform init
    sleep 2
    terraform apply
    echo "Deploy complete!! Now test your code!"
    exit 0
  else
    echo "Invalid input. Please provide 'terraform' as the first input."
    exit 1
  fi
else
  echo "Invalid number of inputs. Please provide either one input for Terraform or two inputs for Terraform and the Lambda function name."
  echo "The command to deploy your terraform is"
  echo "      ./deploy terraform"
  echo "The command to deploy a lambda function is"
  echo "      ./deploy terraform 'lambda_function_name'"
  echo "Example:  ./deploy terraform fileUploaded"

  exit 1
fi