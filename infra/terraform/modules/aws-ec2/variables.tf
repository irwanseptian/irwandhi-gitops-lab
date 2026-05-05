variable "name" {
  description = "Name prefix for bastion resources"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID to place the bastion in"
  type        = string
}

variable "security_group_id" {
  description = "Bastion security group ID (from aws-security-groups module)"
  type        = string
}

variable "key_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "tags" {
  type    = map(string)
  default = {}
}
