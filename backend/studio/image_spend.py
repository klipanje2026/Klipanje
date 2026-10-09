"""Local image token ledger, separate from the provider account balance."""
from decimal import Decimal
from django.db.models import Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import ImageSpend

# Standard Image API rates, official model pages fetched 2026-10-09.
PRICE_SOURCE = 'https://developers.openai.com/api/docs/models/gpt-image-2.5-flare'

def image_cost(model, usage):
    if model not in ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'] or not isinstance(usage, dict): return None
    details = usage.get('input_tokens_details') or {}
    if not isinstance(details, dict): return None
    text, image, output = details.get('text_tokens'), details.get('image_tokens'), usage.get('output_tokens')
    if any(isinstance(v, bool) or not isinstance(v, int) or v < 0 for v in [text,image,output]): return None
    if usage.get('input_tokens') != text + image: return None
    return (Decimal(text)*5 + Decimal(image)*8 + Decimal(output)*30) / Decimal(1000000)

def record_image(user, model, usage):
    usage = usage if isinstance(usage,dict) else {}
    return ImageSpend.objects.create(user=user,model=model,usage=usage,estimated_usd=image_cost(model,usage))

@api_view(['GET'])
def status(request):
    # These three accounts share the local provider key; account billing is never fabricated.
    rows = ImageSpend.objects.all()
    missing = rows.filter(estimated_usd__isnull=True).count()
    total = rows.aggregate(total=Sum('estimated_usd'))['total'] or Decimal(0)
    return Response({'estimatedUsd':float(total),'budgetUsd':10,'images':rows.count(),'unpriced':missing,
                     'scope':'local-images','accountBalanceAvailable':False,
                     'latestAt':rows.order_by('-created_at').values_list('created_at',flat=True).first(),
                     'source':PRICE_SOURCE},headers={'Cache-Control':'no-store'})
