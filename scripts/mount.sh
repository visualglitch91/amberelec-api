#!/bin/sh

if timeout 10 sshfs "$SSH_USER@$SSH_HOST:/roms/" "/mnt/library" -o IdentityFile=/data/id_rsa,ServerAliveInterval=15,ServerAliveCountMax=1,StrictHostKeyChecking=accept-new; then
  echo "Library mounted."
else
  # If timeout occurs or sshfs fails, exit with an error
  echo "Error: SSHFS mount timed out or failed"
  exit 1
fi