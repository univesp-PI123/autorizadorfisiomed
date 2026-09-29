-- Pedido médico sem validade passa a valer 1 ano a partir da data do pedido.
UPDATE "pedidos_medicos"
   SET "validoAte" = ("dataPedido" + INTERVAL '1 year' - INTERVAL '1 day')::date
 WHERE "validoAte" IS NULL;
