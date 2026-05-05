output "instance_id" {
  description = "Connect: ssh -i ~/.ssh/bastion -p 2222 ec2-user@<public_ip>"
  value       = aws_instance.ec2.id
}

output "instance_arn" {
  value = aws_instance.ec2.arn
}

output "public_ip" {
  description = "Static public IP — does not change across stop/start or instance replacement"
  value       = aws_eip.ec2.public_ip
}

output "iam_role_name" {
  value = aws_iam_role.ec2.name
}
