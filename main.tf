terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

terraform {
  backend "s3" {
    bucket         = "terraformstatestorage-stac2024-1"
    key            = "terraformstate/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraformstatedb-stac2024-1"
  }
}

resource "aws_s3_bucket" "bucket" {
  bucket = "terraformstatestorage-stac2024-1"
  lifecycle {
    prevent_destroy = true
  }
  tags = {
    stac2024=true
  }
}

resource "aws_api_gateway_rest_api" "salesforce-2024" {
  name        = "salesforce-api-2024"
  description = "Salesforce API-2024"
}

resource "aws_api_gateway_resource" "salesforce-2024" {
  rest_api_id = aws_api_gateway_rest_api.salesforce-2024.id
  parent_id   = aws_api_gateway_rest_api.salesforce-2024.root_resource_id
  path_part   = "file-upload"
}

resource "aws_api_gateway_method" "salesforce-2024" {
  rest_api_id   = aws_api_gateway_rest_api.salesforce-2024.id
  resource_id   = aws_api_gateway_resource.salesforce-2024.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_lambda_permission" "salesforce-2024" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getFileFromSalesforce.arn
  principal     = "apigateway.amazonaws.com"
}

resource "aws_api_gateway_integration" "salesforce-2024" {
  rest_api_id             = aws_api_gateway_rest_api.salesforce-2024.id
  resource_id             = aws_api_gateway_resource.salesforce-2024.id
  http_method             = aws_api_gateway_method.salesforce-2024.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.getFileFromSalesforce.invoke_arn
}

resource "aws_api_gateway_deployment" "salesforce-2024" {
  depends_on  = [aws_api_gateway_integration.salesforce-2024]
  rest_api_id = aws_api_gateway_rest_api.salesforce-2024.id
  stage_name  = "prod"
  variables = {
    "lambdaAlias" = aws_lambda_alias.salesforce-2024.name
  }
}

resource "aws_lambda_alias" "salesforce-2024" {
  name             = "prod"
  function_name    = aws_lambda_function.getFileFromSalesforce.function_name
  function_version = "$LATEST"
}

resource "aws_iam_role_policy" "api_gateway_policy" {
  name        = "api_gateway_policy"
  role        = "api_gateway_role"

  # description = "IAM policy for API Gateway"

  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "execute-api:Invoke",
        "Resource": "arn:aws:execute-api:*:*:*/*"
      }
    ]
  })
}

resource "aws_iam_role" "api_gateway_role" {
  name               = "api_gateway_role"

  assume_role_policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "apigateway.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_gateway_policy_attachment" {
  role       = aws_iam_role.api_gateway_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess"
}

resource "aws_iam_policy" "cloudwatch_policy" {
  name        = "cloudwatch_policy"
  description = "Policy for API Gateway to publish metrics to CloudWatch"

  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "cloudwatch:PutMetricData"
        ],
        "Resource": "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cloudwatch_policy_attachment" {
  policy_arn = aws_iam_policy.cloudwatch_policy.arn
  role       = aws_iam_role.api_gateway_role.name
}

resource "aws_iam_role" "lambda_role" {
  name = "lambda_exec_role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Action    = "sts:AssumeRole",
        Effect    = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_lambda_function" "getFileFromSalesforce" {
  filename         = "getFileFromSalesforce.zip"
  function_name    = "getFileFromSalesforce"
  role             = aws_iam_role.lambda_role.arn
  handler          = "getFileFromSalesforce/handler.getFile"
  source_code_hash = filebase64sha256("getFileFromSalesforce.zip")
  runtime          = "nodejs18.x"
  timeout          = var.LAMBDA_TIMEOUT
  environment {
    variables = {
      BUCKET_NAME       = aws_s3_bucket.stac2024-saved-files.id
      LAMBDA_TIMEOUT    = var.LAMBDA_TIMEOUT
    }
  }
  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs_policy
  ]
}

resource "aws_s3_bucket" "stac2024-saved-files" {
  bucket = "stac2024-saved-files"
  lifecycle {
    prevent_destroy = true
  }
  tags = {
    stac2024=true
  }
}

resource "aws_iam_role_policy_attachment" "lambda_logs_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# resources for Amazon Translate

resource "aws_iam_policy" "translate_policy" {
  name        = "translate_policy"
  description = "A policy that allows translation via Amazon Translate"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = [
        "translate:TranslateText"
      ],
      Effect   = "Allow",
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_translate_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.translate_policy.arn
}

resource "aws_lambda_function" "translate_lambda" {
  function_name = "TranslateTextFunction"

  # Assuming the ZIP file has been created and contains your Lambda code
  # s3_bucket = "your_lambda_bucket_here"
  # s3_key    = "your_lambda_function.zip"

  handler = "index.handler" # The function entrypoint in your code
  role    = aws_iam_role.lambda_role.arn
  runtime = "nodejs18.x" # Update to the latest supported runtime for AWS Lambda

  environment {
    variables = {
      translate_region = "us-east-1"
    }
  }
}

# resource "aws_api_gateway_rest_api" "translate_api_gateway" {
#   name        = "TranslateApiGateway"
#   description = "API Gateway for Amazon Translate"
# }

# resource "aws_api_gateway_resource" "translate_resource" {
#   rest_api_id = aws_api_gateway_rest_api.translate_api_gateway.id
#   parent_id   = aws_api_gateway_rest_api.translate_api_gateway.root_resource_id
#   path_part   = "translate"
# }

# resource "aws_api_gateway_method" "translate_post_method" {
#   rest_api_id   = aws_api_gateway_rest_api.translate_api_gateway.id
#   resource_id   = aws_api_gateway_resource.translate_resource.id
#   http_method   = "POST"
#   authorization = "NONE"
# }

# resource "aws_api_gateway_integration" "lambda_integration" {
#   rest_api_id = aws_api_gateway_rest_api.translate_api_gateway.id
#   resource_id = aws_api_gateway_resource.translate_resource.id
#   http_method = aws_api_gateway_method.translate_post_method.http_method

#   integration_http_method = "POST"
#   type                    = "AWS_PROXY"
#   uri                     = aws_lambda_function.translate_lambda.invoke_arn
# }

# resource "aws_api_gateway_deployment" "translate_api_deployment" {
#   depends_on = [
#     aws_api_gateway_integration.lambda_integration
#   ]

#   rest_api_id = aws_api_gateway_rest_api.translate_api_gateway.id
#   stage_name  = "v1"
# }

# Output the HTTPS endpoint of the API Gateway to be added in Salesforce
# output "translate_api_gateway_endpoint" {
#   value = aws_api_gateway_deployment.translate_api_deployment.invoke_url
# }