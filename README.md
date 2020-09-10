# Licode

An Open Source WebRTC Communications Platform.

With Licode you can host your own WebRTC conference provider and build applications on top of it with easy to use APIs: [client-side](http://licode.readthedocs.io/en/master/client_api/) and [server-side](http://licode.readthedocs.io/en/master/server_api/).

You have two options to start using Licode:

* If you want a quick taste of what Licode can do or you are familiar with [Docker](http://www.docker.com) - [How to use the docker image or build your own](http://licode.readthedocs.io/en/master/docker/)

* If you are interested in contributing, want to get a better view of the Licode architecture or you don't trust those fancy containers - [How to build Licode from source](http://licode.readthedocs.io/en/master/from_source/)

## Installation

We have dockerized this project and provided a bash command to easily manage installation and running it. Before starting, you have to configure your environment by looking into the [local directory](https://github.com/hamidgh83/licode/tree/master/local) and then bui;d the docker image by command: 

```bash
./video-server.sh build
```

It takes a while to build the image. Then you can start the server by running:

```bash
./video-server.sh run
```

#### Deploying Licode with Nginx

Clients connect to the application and to the socket.io server using the HTTPS port (443), Then, Nginx redirects the requests to the HTTP ports (3001 and 8080 respectively).

Configuring the scenario is very simple. You have just to install and configure an instance of Nginx and to introduce a small change in Licode’s default configuration. The following steps explain how to proceed with this configuration in Ubuntu 16.04:

1. Install nginx
```bash
sudo install nginx
```

2. Configure nginx by editing the default configuration file (in /etc/nginx/sites-enabled/) or by creating and enabling your own one:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name {your_server_name};
    return 301 https://$server_name$request_uri;
}

server {
   listen 443;
   server_name {your_server_name};

   ssl on;
   ssl_certificate {path/to/your/ssl_cert/file};
   ssl_certificate_key {path/to/your/ssl_key/file};
   ssl_session_cache shared:SSL:10m;

   ssl_ciphers !RC4:HIGH:!aNULL:!MD5;
   ssl_prefer_server_ciphers on;
   ssl_protocols TLSv1.2 TLSv1.1 TLSv1;

	location /socket.io/ {
		proxy_pass http://localhost:8080/socket.io/;

		proxy_http_version 1.1;
		proxy_redirect off;

		proxy_set_header 'Access-Control-Allow-Origin' '*';
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header Host $http_host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-NginX-Proxy true;
		proxy_read_timeout 86400;
	}

	location / {
		proxy_pass http://localhost:3001/;
		proxy_set_header Host $host;
		proxy_http_version 1.1;
	}
}
```

> *Note that you have to modify the text in {your_server_name}, {path/to/your/ssl_cert/file} and {path/to/your/ssl_key/file}*.

Configure socket.io connection in licode_config.js file. You have just to change the following parameters:

```nginx
[...]

// This configuration is used by the clients to reach erizoController
// Use '' to use the public IP address instead of a hostname
config.erizoController.hostname = ''; //default value: ''
config.erizoController.port = 443; //default value: 8080
// Use true if clients communicate with erizoController over SSL
config.erizoController.ssl = true; //default value: false

// This configuration is used by erizoController server to listen for connections
// Use true if erizoController listens in HTTPS.
config.erizoController.listen_ssl = false; //default value: false
config.erizoController.listen_port = 8080; //default value: 8080

[...]
```
As you can see, erizoController is still listening on 8080 port but clients will try to reach it on 443 port using SSL. Then, Nginx will redirect them to the correct port based on the /socket.io/ path.

And… that’s all. Enjoy Licode!

## License

[MIT License](https://github.com/lynckia/licode/blob/master/LICENSE).

More info at:
http://www.lynckia.com/licode
