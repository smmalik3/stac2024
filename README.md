# stac2024
Lost Sharks STAC Team Code Repo - 2024

AWS infrastructure deployed and managed by Terraform
Salesforce Code Repo


## Setting things up

1. Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
2. Install [Terraform](https://developer.hashicorp.com/terraform/downloads)
3. Create [Access Keys](https://docs.aws.amazon.com/powershell/latest/userguide/pstools-appendix-sign-up.html) for your AWS user
    - In console type `aws configure`
    - Enter your AWS Access Key
    - Enter your AWS Secret Key
4. You will have to set up remote state storage for Terraform, you can use Amazon S3 and Amazon DynamoDB as the backend storage for your Terraform state. Here's how you can set it up:
    - **Create an S3 bucket:** Start by creating an S3 bucket in AWS that will be used to store the Terraform state file.
        1. Go to the AWS Management Console and navigate to the S3 service.
        2. Click on "Create bucket" and provide a unique name for your bucket. 
            - *e.g., terraformstatestorage-stac2023*
        3. Choose the region where you want to create the bucket.
            - *e.g., us-east-1*
        4. Configure the bucket settings as per your requirements, such as enabling versioning or enabling server-side encryption.
        5. Keep note of the bucket name as you'll need it in the next steps.
    - **Create a DynamoDB table:** Next, create a DynamoDB table to be used as a locking mechanism for Terraform state.
        1. Go to the AWS Management Console and navigate to the DynamoDB service.
        2. Click on "Create table" and provide a unique name for your table.
        3. Set the partition key attribute name to **LockID**.
        4. Enable auto scaling if desired and configure other settings as per your needs.
        5. Create the table and remember the table name
            - *e.g., terraformstatedb-stac2023*
    - **Configure Terraform backend:** In your Terraform configuration files, specify the backend configuration to use S3 and DynamoDB for remote state storage.
        1. Open your Terraform configuration file (*e.g., main.tf*) in a text editor.
        2. Add the following code snippet to configure the backend (should be placed towards the top of the file, preferrably right after the provider section):
        ```
            terraform {
                backend "s3" {
                    bucket         = "your-bucket-name"
                    key            = "path/to/your/terraform.tfstate"
                    region         = "aws-region"
                    dynamodb_table = "your-dynamodb-table-name"
                }
            }
        ```
        3. Based on the example values provided above, your snippet will look like this:
        ```
            terraform {
                backend "s3" {
                    bucket         = "terraformstatestorage-stac2023"
                    key            = "terraformstate/terraform.tfstate"
                    region         = "us-east-1"
                    dynamodb_table = "terraformstatedb-stac2023"
                }
            }
        ```
    - **Initialize Terraform:** After configuring the backend, initialize Terraform to set up the remote state storage.
        1. Open a terminal or command prompt and navigate to the directory containing your Terraform configuration files.
        2. Run the terraform init command. Terraform will initialize the backend and download the necessary provider plugins.
    - **Apply Terraform changes:** Once the backend is configured and initialized, you can proceed with applying changes to your infrastructure using Terraform.
        1. Run the terraform apply command in your Terraform directory to create or update the resources defined in your configuration.

    Now, Terraform will use the specified S3 bucket and DynamoDB table for remote state storage. Each time you run Terraform commands, it will read and write the state to the configured S3 bucket, and leverage the DynamoDB table for state locking to ensure safe concurrent access.
    
5. Run the deploy script by entering `./deploy.sh`
    - Follow any feedback from the script to get going or read on below
    - You need a variables.tf file in your root directory that looks similar to:
        ```
            variable "region" {
            default = "us-east-1"
            }

            variable "OPENAI_API_KEY" {
            type    = string
            default = "ENTER_OPENAI_API_KEY_HERE"
            }'
        ```
        - **NOTE:** *variables.tf* is where all the lambda environment variables will be stored, never commit to repo.
    - The command to deploy your terraform is
        ` ./deploy.sh terraform`
    - The command to deploy a lambda function is
        ` ./deploy.sh terraform 'lambda_function_name'`
        - Example: ` ./deploy.sh terraform fileUploaded`
6. Make updates on a feature branch
7. Please create a PR and have one Approval before merging code