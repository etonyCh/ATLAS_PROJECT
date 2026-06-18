import os

def find_processes():
    for name in os.listdir('/proc'):
        if name.isdigit():
            try:
                with open(os.path.join('/proc', name, 'cmdline'), 'r') as f:
                    cmdline = f.read().replace('\x00', ' ').strip()
                with open(os.path.join('/proc', name, 'wchan'), 'r') as f:
                    wchan = f.read().strip()
                print(f"PID {name} | Cmd: {cmdline} | Wchan: {wchan}")
            except Exception as e:
                pass

if __name__ == '__main__':
    find_processes()
