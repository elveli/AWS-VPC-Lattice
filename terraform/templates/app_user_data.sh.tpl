#!/bin/bash
set -eux

dnf install -y nginx

cat > /etc/nginx/conf.d/lattice-demo.conf <<CONF
server {
    listen 80 default_server;

    location = ${health_path} {
        default_type text/plain;
        return 200 "OK - ${service_name}";
    }

    location / {
        default_type text/plain;
        return 200 "Hello from ${service_name}";
    }
}
CONF

rm -f /etc/nginx/conf.d/default.conf
systemctl enable nginx
systemctl restart nginx
