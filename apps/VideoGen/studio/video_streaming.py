"""Local MP4 streaming with byte ranges for browser seeking."""
import re
from django.http import HttpResponse,StreamingHttpResponse

def video_response(request,field):
    size=field.size;start=0;end=max(0,size-1);partial=False
    header=request.headers.get('Range')
    if header:
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header.strip())
        if not match or not any(match.groups()):return invalid_range(size)
        left,right=match.groups()
        if left:
            start=int(left);end=min(int(right),size-1) if right else size-1
        else:
            suffix=int(right)
            if not suffix:return invalid_range(size)
            start=max(0,size-suffix);end=size-1
        if start>=size or start>end:return invalid_range(size)
        partial=True
    length=end-start+1 if size else 0
    if request.method=='HEAD':response=HttpResponse(content_type='video/mp4',status=206 if partial else 200)
    else:
        def chunks():
            with field.open('rb') as video:
                video.seek(start);remaining=length
                while remaining:
                    chunk=video.read(min(256*1024,remaining))
                    if not chunk:break
                    remaining-=len(chunk);yield chunk
        response=StreamingHttpResponse(chunks(),content_type='video/mp4',status=206 if partial else 200)
    response['Accept-Ranges']='bytes';response['Content-Length']=str(length);response['X-Content-Type-Options']='nosniff';response['Cache-Control']='private, max-age=300'
    if partial:response['Content-Range']=f'bytes {start}-{end}/{size}'
    return response

def invalid_range(size):
    response=HttpResponse(status=416);response['Content-Range']=f'bytes */{size}';response['Accept-Ranges']='bytes';return response
