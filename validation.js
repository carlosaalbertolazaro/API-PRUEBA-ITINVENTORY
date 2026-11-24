const ESTADOS = new Set(["DISPONIBLE", "EN_USO", "MANTENIMIENTO", "BAJA"]);
const CAMPOS_DE_TEXTO = [
  "numeroSerie",
  "marca",
  "modelo",
  "fechaAdquisicion",
  "ubicacion",
];

function esFechaValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function validarEquipo(equipo) {
  for (const campo of CAMPOS_DE_TEXTO) {
    if (typeof equipo[campo] !== "string" || !equipo[campo].trim()) {
      return `El campo ${campo} es obligatorio.`;
    }
  }

  if (!esFechaValida(equipo.fechaAdquisicion)) {
    return "fechaAdquisicion debe tener el formato AAAA-MM-DD y ser una fecha válida.";
  }

  if (!Number.isInteger(equipo.numeroInventario) || equipo.numeroInventario <= 0) {
    return "numeroInventario debe ser un entero mayor que cero.";
  }

  if (!ESTADOS.has(equipo.estado)) {
    return `estado debe ser uno de: ${Array.from(ESTADOS).join(", ")}.`;
  }

  return null;
}

function normalizarEquipo(equipo) {
  const normalizado = { ...equipo };
  for (const campo of CAMPOS_DE_TEXTO) {
    normalizado[campo] = normalizado[campo].trim();
  }
  return normalizado;
}

function equipoValidation(req, res, next) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    next();
    return;
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "El cuerpo de la petición debe ser un objeto JSON." });
    return;
  }

  const id = req.path.split("/").filter(Boolean)[0];
  const equipos = req.app.db.get("equipos");
  const existente = id ? equipos.getById(id).value() : null;

  if (id && !existente) {
    next();
    return;
  }

  const candidato = { ...existente, ...req.body };
  const error = validarEquipo(candidato);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  const equipoNormalizado = normalizarEquipo(candidato);

  const duplicado = equipos.find((equipo) => {
    const esOtroEquipo = String(equipo.id) !== String(equipoNormalizado.id ?? id ?? "");
    return esOtroEquipo && (
      equipo.numeroSerie.toLowerCase() === equipoNormalizado.numeroSerie.toLowerCase()
      || equipo.numeroInventario === equipoNormalizado.numeroInventario
    );
  }).value();

  if (duplicado) {
    res.status(409).json({
      error: "Ya existe un equipo con el mismo número de serie o inventario.",
    });
    return;
  }

  req.body = equipoNormalizado;
  next();
}

module.exports = { equipoValidation, esFechaValida, validarEquipo };
