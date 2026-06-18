import redis

def check_redis():
    for db_num in [0, 1]:
        print(f"\n--- Redis DB {db_num} ---")
        r = redis.Redis(host='redis', port=6379, db=db_num)
        keys = r.keys('*')
        print(f"Found {len(keys)} keys:")
        for k in keys:
            try:
                t = r.type(k).decode('utf-8')
                val = b""
                if t == 'string':
                    val = r.get(k)
                elif t == 'hash':
                    val = str(r.hgetall(k))
                else:
                    val = f"type: {t}"
                
                # truncate
                val_str = str(val)
                if len(val_str) > 150:
                    val_str = val_str[:150] + "..."
                print(f"- {k.decode('utf-8', errors='ignore')} ({t}): {val_str}")
            except Exception as e:
                print(f"- {k.decode('utf-8', errors='ignore')}: error {e}")

if __name__ == '__main__':
    check_redis()
