import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Xác định đường dẫn thư mục Vault
vault_env = os.getenv("OBSIDIAN_VAULT_PATH") or os.getenv("VAULT_PATH")
if vault_env and Path(vault_env).exists():
    VAULT_DIR = Path(vault_env).resolve()
elif (Path(__file__).parent.parent / "vault").exists():
    VAULT_DIR = (Path(__file__).parent.parent / "vault").resolve()
elif (Path(__file__).parent / "vault").exists():
    VAULT_DIR = (Path(__file__).parent / "vault").resolve()
else:
    VAULT_DIR = Path("./vault").resolve()

VAULT_DIR.mkdir(parents=True, exist_ok=True)

# Thư mục lưu file đính kèm (PDF scan) và thư mục văn bản trong Vault
ATTACHMENTS_DIR = VAULT_DIR / "Attachments"
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENTS_VAULT_DIR = VAULT_DIR / "VanBan"
DOCUMENTS_VAULT_DIR.mkdir(parents=True, exist_ok=True)

# Cấu hình CSDL (Mặc định SQLite lưu trong Vault để đồng bộ dữ liệu)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_file = VAULT_DIR / "docuvault.db"
    DATABASE_URL = f"sqlite:///{db_file}"

# SQLite cần connect_args={"check_same_thread": False}
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
