output "instance_id" {
  description = "Connect: ssh -i ~/.ssh/bastion -p 2222 ec2-user@<public_ip>"
  value       = module.aws-ec2-cronpilot.instance_id
}

output "instance_arn" {
  value = module.aws-ec2-cronpilot.instance_arn
}

output "public_ip" {
  description = "Static public IP — does not change across stop/start or instance replacement"
  value       = module.aws-ec2-cronpilot.public_ip
}

output "iam_role_name" {
  value = module.aws-ec2-cronpilot.iam_role_name
}
