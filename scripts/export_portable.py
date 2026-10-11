import bpy, pathlib, hashlib, json
from mathutils import Matrix, Vector
source=pathlib.Path(bpy.data.filepath); before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.context.scene.frame_set(1)
root=bpy.data.objects['JUICE | handheld product assembly']; graph=bpy.context.evaluated_depsgraph_get()
origin=root.matrix_world.translation.copy(); converted=[]
for obj in [root]+list(root.children_recursive):
 if obj.type not in {'MESH','CURVE','FONT'} or obj.hide_render: continue
 evaluated=obj.evaluated_get(graph)
 if abs(evaluated.matrix_world.determinant())<1e-12: continue
 mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=graph)
 if not mesh.vertices: bpy.data.meshes.remove(mesh); continue
 copy=bpy.data.objects.new(obj.name+' [web snapshot]',mesh)
 copy.matrix_world=Matrix.Translation(-origin) @ evaluated.matrix_world
 converted.append(copy)
scene=bpy.data.scenes.new('Portable export only'); bpy.context.window.scene=scene
for obj in converted: scene.collection.objects.link(obj); obj.select_set(True)
output=pathlib.Path(__file__).resolve().parents[1] / 'public/models/mma-test/portable-nitrate_R04.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('PORTABLE_EXPORT',json.dumps({'source':str(source),'source_sha256':before,'objects':len(converted),'frame':1,'output_bytes':output.stat().st_size,'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
