export interface DocumentStyle {
  pageSize: "CARTA";
  marginTop: number; // en puntos (ej. 72pt = 1 pulgada)
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  fontFamily: string;
}

export const INSTITUTIONAL_STYLE: DocumentStyle = {
  pageSize: "CARTA",
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
  primaryColor: "#0D2B52", // Azul CEIPOL
  secondaryColor: "#1F4E79", // Azul operativo
  textColor: "#1A1A1A",
  fontFamily: "Arial",
};
