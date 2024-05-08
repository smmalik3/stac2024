const AWS = require('aws-sdk');
const s3 = new AWS.S3();

module.exports.getFile = async (event) => {
  try {
    // const { content, filename } = event;
    json_event_body = JSON.stringify(event.body)
    parsed_body = JSON.parse(json_event_body)
    json_body = JSON.parse(parsed_body)
    console.log("JSON Body =======> " + json_body)
    console.log("event =======>>>>> " + JSON.stringify(event))
    console.log("FILENAME =======>>>> " + json_body.filename)
    console.log("BODY =======> " + json_body.content)
    const filename = json_body.filename
    const content = json_body.content
    // Decode the base64-encoded file content
    const decodedContent = Buffer.from(content, 'base64');

    // Save the file to S3
    // const bucketName = 'stac2024-saved-files';
    const bucketName = process.env.BUCKET_1_NAME;
    const key = filename;
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: decodedContent
    };

    await s3.putObject(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'File saved successfully to S3' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save file to S3' })
    };
  }
};