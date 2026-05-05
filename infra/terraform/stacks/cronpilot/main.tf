module "aws-ec2-cronpilot" {
  source = "../../modules/aws-ec2"

  name              = var.name
  subnet_id         = var.subnet_id
  security_group_id = var.security_group_id
  key_name          = var.key_name
}
