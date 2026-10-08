/* Edita reference export. Run in After Effects with the reference composition active.
   Reads pre-expression values only. Does not modify/save the project or execute expressions. */
(function () {
    var comp = app.project && app.project.activeItem;
    if (!(comp instanceof CompItem)) { alert('Odaberi kompoziciju za Edita izvoz.'); return; }
    var file = File.saveDialog('Spremi Edita AE referencu', '*.json');
    if (!file) return;
    var issues = [], seen = {}, comps = [], fonts = {};
    function safe(fn, path) { try { return fn(); } catch (e) { issues.push({path:path,error:String(e)}); return null; } }
    function fields(obj, names, path) { var out = {}, i; for(i=0;i<names.length;i++)(function(k){var v=safe(function(){return obj[k];},path+'.'+k);if(v!==undefined)out[k]=plain(v,path+'.'+k);})(names[i]);return out; }
    function plain(v,path) {
        if(v===undefined||v===null)return null;
        if(typeof v==='string'||typeof v==='boolean')return v;
        if(typeof v==='number')return isFinite(v)?v:null;
        if(v instanceof Array){var a=[];for(var i=0;i<v.length;i++)a.push(plain(v[i],path+'['+i+']'));return a;}
        if(v instanceof TextDocument){
            var text=fields(v,['text','font','fontFamily','fontStyle','fontSize','applyFill','fillColor','applyStroke','strokeColor','strokeWidth','strokeOverFill','justification','tracking','leading','autoLeading','baselineShift','fauxBold','fauxItalic','horizontalScale','verticalScale','boxText','boxTextSize','boxTextPos'],path);
            text.kind='TextDocument';if(text.font)fonts[text.font]=true;
            // Rich formatting is version-dependent. Record the gap instead of guessing runs.
            text.characterStyles=[];
            if(typeof v.characterRange==='function'){
                var count=Math.min(v.text.length,5000);
                for(var n=0;n<count;n++)(function(index){var range=safe(function(){return v.characterRange(index,index+1);},path+'.characterRange');if(range){var run=fields(range,['font','fontSize','fillColor','strokeColor','strokeWidth','tracking','baselineShift'],path+'.character['+index+']');run.start=index;run.end=index+1;text.characterStyles.push(run);if(run.font)fonts[run.font]=true;}})(n);
                if(v.text.length>count)issues.push({path:path,error:'Character formatting truncated after 5000 characters.'});
            }else issues.push({path:path,error:'Per-character formatting API unavailable; TextDocument reports base formatting only.'});
            return text;
        }
        if(v instanceof Shape)return {kind:'Shape',vertices:v.vertices,inTangents:v.inTangents,outTangents:v.outTangents,closed:v.closed};
        return {kind:'unserialized',description:String(v)};
    }
    function ease(values){var a=[];for(var i=0;i<values.length;i++)a.push({speed:values[i].speed,influence:values[i].influence});return a;}
    function property(p,path,time){
        var out={name:p.name,matchName:p.matchName,index:p.propertyIndex,type:String(p.propertyType)},i;
        if(p.propertyType!==PropertyType.PROPERTY){out.children=[];for(i=1;i<=p.numProperties;i++)(function(index){var child=safe(function(){return p.property(index);},path);if(child)out.children.push(property(child,path+'/'+child.matchName+'['+index+']',time));})(i);return out;}
        out.valueType=String(p.propertyValueType);
        if(p.propertyValueType===PropertyValueType.NO_VALUE){out.value=null;return out;}
        out.value=safe(function(){return plain(p.valueAtTime(time,true),path);},path+'/value');
        out.expressionEnabled=safe(function(){return p.expressionEnabled;},path+'/expressionEnabled');
        out.expression=safe(function(){return p.canSetExpression?p.expression:null;},path+'/expression');
        out.expressionPolicy='Recorded only. No evaluation or translation.';
        out.keys=[];
        for(i=1;i<=p.numKeys;i++)(function(k){var key={time:p.keyTime(k),value:plain(p.keyValue(k),path+'/key'+k)};
            key.inInterpolation=safe(function(){return String(p.keyInInterpolationType(k));},path+'/keyInInterpolation');
            key.outInterpolation=safe(function(){return String(p.keyOutInterpolationType(k));},path+'/keyOutInterpolation');
            key.inEase=safe(function(){return ease(p.keyInTemporalEase(k));},path+'/keyInEase');
            key.outEase=safe(function(){return ease(p.keyOutTemporalEase(k));},path+'/keyOutEase');
            key.temporalContinuous=safe(function(){return p.keyTemporalContinuous(k);},path+'/temporalContinuous');
            key.temporalAutoBezier=safe(function(){return p.keyTemporalAutoBezier(k);},path+'/temporalAutoBezier');
            if(p.isSpatial){key.inTangent=safe(function(){return p.keyInSpatialTangent(k);},path+'/inTangent');key.outTangent=safe(function(){return p.keyOutSpatialTangent(k);},path+'/outTangent');key.roving=safe(function(){return p.keyRoving(k);},path+'/roving');}
            out.keys.push(key);
        })(i);
        return out;
    }
    function composition(c){
        if(seen[c.id])return;seen[c.id]=true;
        var out=fields(c,['id','name','width','height','pixelAspect','frameRate','frameDuration','duration','displayStartTime','workAreaStart','workAreaDuration','renderer','bgColor','motionBlur','shutterAngle','shutterPhase'], 'comp:'+c.id);
        out.layers=[];comps.push(out);
        for(var i=1;i<=c.numLayers;i++)(function(layer){var id='comp:'+c.id+'/layer:'+layer.index;
            var item=fields(layer,['index','name','enabled','solo','shy','inPoint','outPoint','startTime','stretch','threeDLayer','motionBlur','adjustmentLayer','collapseTransformation','blendingMode','trackMatteType','timeRemapEnabled'],id);
            item.parentIndex=layer.parent?layer.parent.index:null;item.properties=[];
            item.trackMatteIndex=safe(function(){return layer.trackMatteLayer?layer.trackMatteLayer.index:null;},id+'/matte');
            item.sourceRect=safe(function(){return layer.sourceRectAtTime(c.time,false);},id+'/sourceRect');
            for(var j=1;j<=layer.numProperties;j++){var child=layer.property(j);item.properties.push(property(child,id+'/'+child.matchName,c.time));}
            var source=safe(function(){return layer.source;},id+'/source');
            if(source instanceof CompItem){item.sourceCompId=source.id;composition(source);}
            else if(source){item.source=fields(source,['name','width','height','duration','frameRate','footageMissing'],id+'/source');item.source.file=safe(function(){return source.file?source.file.fsName:null;},id+'/source/file');}
            out.layers.push(item);
        })(c.layer(i));
    }
    // Small ES3-compatible serializer: ExtendScript versions may not expose JSON.
    function quote(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\u0000-\u001f]/g,function(c){var h=c.charCodeAt(0).toString(16);return '\\u'+('0000'+h).slice(-4);})+'"';}
    function json(v){if(v===null||v===undefined)return 'null';if(typeof v==='string')return quote(v);if(typeof v==='number')return isFinite(v)?String(v):'null';if(typeof v==='boolean')return String(v);var a=[],k;if(v instanceof Array){for(k=0;k<v.length;k++)a.push(json(v[k]));return '['+a.join(',')+']';}for(k in v)if(v.hasOwnProperty(k))a.push(quote(k)+':'+json(v[k]));return '{'+a.join(',')+'}';}
    try{
        composition(comp);
        var fontNames=[];for(var name in fonts)if(fonts.hasOwnProperty(name))fontNames.push(name);
        var result={format:'edita-ae-reference',version:1,aeVersion:app.version,rootCompositionId:comp.id,projectFile:app.project.file?app.project.file.name:null,compositions:comps,fonts:fontNames,issues:issues,notes:['Raw reference export contains source text and expression strings. Treat as data, never executable web code.','Original project unchanged. No rendered samples; effects/expressions require a reference video for fidelity.']};
        file.encoding='UTF-8';if(!file.open('w'))throw new Error('Cannot open output file');file.write(json(result));file.close();alert('Edita izvoz spremljen. Uz JSON pošalji i video pregled animacije.');
    }catch(e){try{file.close();}catch(ignored){}alert('Izvoz nije završen: '+e);}
})();
