const debug = require('nice_debug')('FILE_SAVER_DEBUG')

const router = require('express').Router()
const fs = require('fs');

const URL_PREFIX = 'files'
const channels = [];

function generateFileChannel(channel_args) {
  let channel_id = channels.push(channel_args) - 1;
  return channel_id;
}

function attacheResponseStreamToChannel({ res, channel_id }) {
  channels[channel_id].response_stream = res;
}

module.exports = function() {
  function plugin(events, actions) {
    events.onMessage((client, message) => {
      debug(5, "got message to the plugin")
      if(message.type === 'file') {
        debug(5, "got file message")
        const channel_id = generateFileChannel({
          uploader_id: client.client_id,
          uploader_socket: client,
          uploader_file_id: message.local_id,
          filename: message.filename
        })
        client.session.sendToAllInSession({
          message: {
            type: 'file',
            filename: message.filename,
            download_url: `/${URL_PREFIX}/${channel_id}`
          },
          sender: client.client_id
        })
      }
    })
  }

  router.post(`/${URL_PREFIX}/:channel`, (req, res, next) => {
    debug(5, "got POST on file channel")
    const channel_id = req.params['channel'];
    const channel = channels[channel_id];

    req.pipe(channel.response_stream);
    req.on('end', () => {
      channel.response_stream.end()
    })
  })

  router.get(`/${URL_PREFIX}/:channel`, (req, res, next) => {
    debug(5, "got GET on file channel")

    const channel_id = req.params['channel'];
    const channel = channels[channel_id];
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${channel.filename}"`
    })
    attacheResponseStreamToChannel({ res, channel_id: req.params['channel'] })
    channel.uploader_socket.send({
      type: 'upload',
      upload_id: channel.uploader_file_id,
      upload_url: `/${URL_PREFIX}/${channel_id}`
    })
  })

  return { router, plugin };
}
