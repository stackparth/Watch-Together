from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from datetime import datetime
from database import db
from models import ActionPayload, ChatPayload
import os

router = APIRouter()

@router.get("/")
async def get():
    # Load HTML from file instead of inline string
    template_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(html_content)

@router.get("/api/state/{room_id}")
async def get_state(room_id: str, username: str = "", is_admin: str = "false"):
    is_admin_bool = is_admin.lower() == 'true'
    
    # Ensure DB room exists
    room = await db.rooms.find_one({"room_id": room_id})
    if not room:
        room = {
            "room_id": room_id,
            "video_id": "_o7qjN3KF8U",
            "state": "paused",
            "current_time": 0.0,
            "action": "sync",
            "admin_username": username if is_admin_bool else None
        }
        await db.rooms.insert_one(room)
    else:
        # Update admin if taking over and no admin exists
        if is_admin_bool and not room.get("admin_username"):
            await db.rooms.update_one({"room_id": room_id}, {"$set": {"admin_username": username}})

    # Fetch chat history
    cursor = db.messages.find({"room_id": room_id}).sort("timestamp", 1).limit(100)
    history = await cursor.to_list(length=100)
    
    formatted_history = [
        {"sender": msg["sender"], "message": msg["message"], "is_admin": msg.get("is_admin", False)}
        for msg in history
    ]

    return {
        "video_id": room["video_id"],
        "history": formatted_history,
        "current_time": room["current_time"],
        "state": room["state"],
        "action": room.get("action", "sync")
    }

@router.post("/api/action/{room_id}")
async def post_action(room_id: str, payload: ActionPayload):
    # Process Admin Video Action
    action = payload.action
    update_data = {"action": action}
    
    if action == "change":
        if payload.video_id:
            update_data["video_id"] = payload.video_id
            update_data["current_time"] = 0.0
            update_data["state"] = "paused"
    elif action in ["play", "pause"]:
        update_data["current_time"] = payload.time
        update_data["state"] = "playing" if action == "play" else "paused"
    elif action == "sync":
        update_data["current_time"] = payload.time
        if payload.state:
            update_data["state"] = payload.state
            
    await db.rooms.update_one({"room_id": room_id}, {"$set": update_data})
    return {"status": "success"}

@router.post("/api/chat/{room_id}")
async def post_chat(room_id: str, payload: ChatPayload):
    msg_doc = {
        "room_id": room_id,
        "sender": payload.username,
        "message": payload.message,
        "is_admin": payload.is_admin,
        "timestamp": datetime.utcnow()
    }
    await db.messages.insert_one(msg_doc)
    return {"status": "success"}
