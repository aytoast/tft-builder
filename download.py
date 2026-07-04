import urllib.request
import shutil
req = urllib.request.Request('https://raw.communitydragon.org/latest/cdragon/tft/zh_cn.json', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp, open('tft_latest.json', 'wb') as f:
    shutil.copyfileobj(resp, f)
print('Download completed.')
