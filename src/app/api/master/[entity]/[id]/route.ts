export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;

  return Response.json({
    message: `Master ${entity} detail placeholder`,
    entity,
    id,
  });
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;

  return Response.json({
    message: `Update ${entity} ${id} placeholder`,
    entity,
    id,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;

  return Response.json({
    message: `Delete ${entity} ${id} placeholder`,
    entity,
    id,
  });
}
