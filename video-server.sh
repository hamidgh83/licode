#!/usr/bin/env bash

color() {
    printf '\033[%sm%s\033[m\n' "$@"
    # usage color "31;5" "string"
    # 0 default
    # 5 blink, 1 strong, 4 underlined
    # fg: 31 red,  32 green, 33 yellow, 34 blue, 35 purple, 36 cyan, 37 white
    # bg: 40 black, 41 red, 44 blue, 45 purple
}


function usage_command () {
    echo "Usage : video-sever COMMAND";
    echo "Commands:"
    echo "  build"$'\t\t'"Build the video server again";
    echo "  start"$'\t\t'"Start the video server";
    echo "  stop"$'\t\t'"Stop the current running server";
    echo "  log"$'\t\t'"Show running video server logs";
    echo "  help"$'\t\t'"Print usage";

    echo $'\n'
    echo "Run 'video-server COMMAND help' for more information on a command."
}

function build_command() {
    string="Build a new image ..."$'\n'
    color '32;1' "$string" >&1

    IMGID=`docker images -q --filter=reference='licode-image:*'`

    if [ "$IMGID" ]
    then

        echo "Are you sure to want to delete the current image (y/N)?"
        read answer

        if echo "$answer" | grep -iq "^y" ;then
            stop_command

            string="Removing the old image ..."$'\n'
            color '32;1' "$string" >&1

            docker rmi $IMGID
        else
            exit 1
        fi
    fi

    docker build -t licode-image ./
    echo "Done"$'\n'
}

function log_command() {
    CID=`docker ps -aq  --filter "name=licode"`
    if [ ! -z "$CID" ] ; then
        docker logs --follow $CID
    else
        string="There is no running service ..."$'\n';
        color '32;1' "$string" >&1
    fi
}

function stop_command() {
    CID=`docker ps -aq  --filter "name=licode"`
    if [ ! -z "$CID" ]
    then
        string="Stopping the running containers..."$'\n';
        color '32;1' "$string" >&1

        sudo docker stop $CID
        sudo docker rm $CID
    fi
}

function start_command() {
    source ./local/.env

    if [ "$1" == "help" ]; then
        echo "Start the video server"
        echo $'\n'
        echo "Options:"
        echo "  -p,--port port"$'\t\t'"Port number";
        echo "  --min-port port"$'\t\t'"Minimum Port number";
        echo "  --max-port port"$'\t\t'"Maximum Port number";
        echo $'\n'

        exit 1
    fi

    while [ "$1" != "" ]; do
        case $1 in
            -p | --port )
                PORT=$2
                ;;

            --min-port )
                MIN_PORT=$2
                ;;

            --max-port )
                MAX_PORT=$2
                ;;
        esac
        shift
    done

    IMGID=`docker images -q --filter=reference='licode-image:*'`

    if [ -z "$IMGID" ]
    then
        string="Image doesn't exit"$'\n';
        color '31;1' "$string" >&2

        string="Firstly, you should build the image"$'\n';
        color '32;1' "$string" >&2

        string="For building run './video-server.sh build' command"$'\n';
        color '32;1' "$string" >&2

        exit 2
    fi

    stop_command

    sudo docker run -d --name licode --env-file ./local/.env -p  3000:3000 -p $MIN_PORT-$MAX_PORT:$MIN_PORT-$MAX_PORT/udp -p 3001:3001  -p 8080:8080 -v `pwd`/local/basic_example:/opt/licode/extras/basic_example licode-latest-nginx 

    echo "Done"
}


case "$1" in
    start)
        shift
        start_command $*
        ;;

    stop)
        shift
        stop_command $*
        ;;

    log)
        shift
        log_command $*
        ;;

    build)
        shift
        build_command $*
        ;;

    help)
        usage_command
        ;;

    *)
        usage_command
        exit 1
esac
