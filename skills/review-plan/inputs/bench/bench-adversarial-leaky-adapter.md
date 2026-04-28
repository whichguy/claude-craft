# Project Plan: AWS S3 Storage for File Uploads

## Context
We need to move our file uploads from local disk storage to AWS S3 for better durability and scalability.

## Approach
We will update our `FileService` to use the AWS SDK and interact directly with S3.

## Phases

### Phase 1: SDK Installation
- Add `aws-sdk` to `package.json`.

### Phase 2: FileService Update
- Update `FileService.upload` to accept a raw `AWS.S3.PutObjectRequest` object.
- This gives callers full control over S3 features like ACLs, ContentType, and Metadata.
- Implementation:
```javascript
class FileService {
  async upload(params: AWS.S3.PutObjectRequest) {
    const s3 = new AWS.S3();
    return s3.putObject(params).promise();
  }
}
```

### Phase 3: Caller Migration
- Update the `ProfilePictureController`, `DocumentUploadController`, and the frontend file uploader to construct the `PutObjectRequest` with the appropriate bucket name and keys.

## Risks
- S3 bucket permissions (IAM) must be correctly configured.
- Managing AWS credentials in different environments.
