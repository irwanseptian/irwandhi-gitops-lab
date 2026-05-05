locals {
  tags = merge(var.tags, { Module = "ec2" })
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_iam_role" "ec2" {
  name = "${var.name}-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.name}-${var.instance_name}"
  role = aws_iam_role.ec2.name

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "ec2" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.key_name

  associate_public_ip_address = false

  user_data = base64encode(<<-EOF
    #!/bin/bash
    dnf install -y postgresql15 jq

    # Allow port 2222 through SELinux
    semanage port -a -t ssh_port_t -p tcp 2222

    # Allow port 2222 through firewalld
    firewall-cmd --permanent --add-port=2222/tcp
    firewall-cmd --reload

    # Configure SSH to listen on port 2222
    echo "Port 2222" >> /etc/ssh/sshd_config
    systemctl restart sshd
  EOF
  )

  metadata_options {
    http_tokens = "required"
  }

  tags = merge(local.tags, {
    Name = "${var.name}-${var.instance_name}"
  })

  lifecycle {
    ignore_changes = [ami, user_data, associate_public_ip_address]
  }
}

resource "aws_eip" "ec2" {
  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${var.name}-ec2-eip"
  })
}

resource "aws_eip_association" "ec2" {
  instance_id   = aws_instance.ec2.id
  allocation_id = aws_eip.ec2.id
}
