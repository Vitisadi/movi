Download requirements on first run: `pip install -r requirements.txt`
Go to folder: `cd ./movi-api`

# Setup DB (Only run if you made schema changes)
python app/scripts/init_db.py

Connect to venv: `.venv\Scripts\Activate.ps1`
Start backend: `python -m flask --app wsgi:app --debug run --port=3000`

