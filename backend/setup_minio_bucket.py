import json
from minio import Minio

def setup_minio():
    client = Minio(
        "localhost:9000",
        access_key="minio_admin",
        secret_key="minio_password",
        secure=False
    )
    
    bucket_name = "atlas-documents"
    
    if not client.bucket_exists(bucket_name):
        print(f"Creating bucket: {bucket_name}")
        client.make_bucket(bucket_name)
    else:
        print(f"Bucket {bucket_name} already exists.")
        
    # Set public read policy
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
            }
        ]
    }
    client.set_bucket_policy(bucket_name, json.dumps(policy))
    print(f"Public access policy set on {bucket_name}")

if __name__ == "__main__":
    setup_minio()
