from django.contrib import admin
from .models import Workspace, Membership, Project, MediaAsset

admin.site.site_header = 'Klipanje administracija'
admin.site.site_title = 'Klipanje'
admin.site.index_title = 'Korisnici i projekti'
admin.site.register([Workspace, Membership, Project])

@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'size', 'created_at']
    exclude = ['file']
