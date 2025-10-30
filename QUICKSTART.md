# Quick Start

## Terminal 1 - Backend
```bash
cd backend
python -m pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

## Terminal 2 - Dashboard
```bash
cd dashboard
npm install
npm run dev
```

**Done!** Backend runs on `http://127.0.0.1:8000`, Dashboard URL shown in Terminal 2.

> **Note:**  
> `For remote/mobile device access `, you should start [ngrok](https://ngrok.com/) and expose your backend by running:
>
> ```bash
 <!-- ngrok http 8000 -->
> ```
> change line 35 in mobile\lib\services\api_service.dart
> and line 
> This will provide you with a public URL you can use from your mobile device or other remote clients.
