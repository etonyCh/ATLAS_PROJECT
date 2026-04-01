# run the backend in the cmd

docker-compose up -d

cd backend
py -3.12 -m venv env
call env\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000

# run celery in cmd also

call env\Scripts\activate

python run_celery.py -A app.core.celery_app worker --loglevel=info

# or

python run_celery.py -A app.core.celery_app worker --loglevel=info --pool=solo

