module "aws-bastion-test" {
  source = "../../"

  name              = "dev"
  subnet_id         = "subnet-068bdcc4eb63d329a"
  security_group_id = "sg-09a8f574eaa2db121"
  key_name          = "cronpilot"
}