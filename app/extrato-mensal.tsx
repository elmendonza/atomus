import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CampoDataHora } from '@/components/campo-data-hora';
import { supabase } from '@/src/lib/supabase';
import { theme, COR_PARTICULAR } from '@/src/theme';
import { hoje, isoParaDate, dateParaIso } from '@/src/utils/tempo';
import { formatarMoeda } from '@/src/utils/formato';
import { alertar } from '@/src/utils/alerta';
import { LOGO_RAPHAELA_PNG_BASE64 } from '@/src/assets/logo-raphaela';

const ID_PARTICULAR = 'particular';

const MESES_COMPLETO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

type Atendimento = {
  id: string;
  data: string;
  hora: string;
  procedimento: string;
  status: string;
  valor: number;
  paciente_nome: string;
  clinica_id: string | null;
  clinica_nome: string | null;
  clinica_cor: string | null;
};

type Clinica = { id: string; nome: string; cor: string };

function inicioDoMes(mes: string) {
  return `${mes}-01`;
}

function fimDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate();
  return `${mes}-${String(ultimoDia).padStart(2, '0')}`;
}

function somarMeses(mes: string, delta: number) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarDataCurta(dataStr: string) {
  const [, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}`;
}

function formatarDataCompleta(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function ExtratoMensalScreen() {
  const router = useRouter();
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [filtroClinica, setFiltroClinica] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: cli } = await supabase.from('clinicas').select('id, nome, cor').order('nome');
    setClinicas(cli ?? []);

    const { data, error } = await supabase
      .from('atendimentos')
      .select('id, data, hora, procedimento, status, valor, clinica_id, pacientes(nome), clinicas(nome, cor)')
      .gte('data', inicioDoMes(mes))
      .lte('data', fimDoMes(mes))
      .order('data')
      .order('hora');
    setCarregando(false);
    if (error) {
      alertar('Erro ao carregar extrato', error.message);
      return;
    }
    setAtendimentos(
      (data ?? []).map((r: any) => ({
        ...r,
        paciente_nome: r.pacientes?.nome ?? '',
        clinica_nome: r.clinicas?.nome ?? null,
        clinica_cor: r.clinicas?.cor ?? null,
      }))
    );
  }, [mes]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const atendimentosFiltrados = atendimentos.filter((item) => {
    if (filtroClinica === null) return true;
    if (filtroClinica === ID_PARTICULAR) return item.clinica_id === null;
    return item.clinica_id === filtroClinica;
  });

  const [ano, mesNum] = mes.split('-').map(Number);
  const tituloMes = `${MESES_COMPLETO[mesNum - 1]} ${ano}`;
  const realizados = atendimentosFiltrados.filter((a) => a.status === 'realizado').length;
  const nomeClinicaFiltro =
    filtroClinica === null
      ? 'Todas as clínicas'
      : filtroClinica === ID_PARTICULAR
        ? 'Particular'
        : clinicas.find((c) => c.id === filtroClinica)?.nome ?? '';

  function baixarPdf() {
    if (Platform.OS !== 'web') return;
    const itensParaPdf = atendimentosFiltrados.filter((a) => a.status !== 'cancelado');
    const linhas = itensParaPdf
      .map(
        (item) => `
          <tr>
            <td>${item.paciente_nome}</td>
            <td>${formatarDataCompleta(item.data)}</td>
            <td>${item.clinica_nome || 'Particular'}</td>
            <td class="valor">${formatarMoeda(item.valor || 0)}</td>
          </tr>`
      )
      .join('');
    const total = itensParaPdf.reduce((soma, item) => soma + (item.valor || 0), 0);

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Extrato - ${tituloMes}</title>
          <style>
            * { box-sizing: border-box; }
            html { color-scheme: light; }
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #222; background: #fff; }
            .cabecalho {
              text-align: center;
              border-bottom: 2px solid #eee; padding-bottom: 16px; margin-bottom: 24px;
            }
            .cabecalho img { display: block; max-width: 220px; margin: 0 auto 10px; }
            .cabecalho p { margin: 2px 0 0; color: #666; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
            th { color: #666; font-size: 11px; text-transform: uppercase; }
            td.valor, th.valor { text-align: right; }
            tfoot td { font-weight: bold; border-top: 2px solid #222; border-bottom: none; padding-top: 10px; }
            @media print { body { padding: 0 24px; } }
          </style>
        </head>
        <body>
          <div class="cabecalho">
            <img src="data:image/png;base64,${LOGO_RAPHAELA_PNG_BASE64}" alt="Raphaela Scarpa" />
            <p><strong>${tituloMes}</strong> · ${nomeClinicaFiltro}</p>
          </div>
          <table>
            <thead>
              <tr><th>Paciente</th><th>Data</th><th>Local</th><th class="valor">Valor</th></tr>
            </thead>
            <tbody>${linhas || '<tr><td colspan="4">Nenhum atendimento neste período.</td></tr>'}</tbody>
            <tfoot>
              <tr><td colspan="3">Total</td><td class="valor">${formatarMoeda(total)}</td></tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    const janela = window.open('', '_blank');
    if (!janela) {
      alertar('Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.');
      return;
    }
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 250);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Extrato mensal</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.navContainer}>
        <TouchableOpacity onPress={() => setMes((m) => somarMeses(m, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.navTitulo}>{tituloMes}</Text>
        <TouchableOpacity onPress={() => setMes((m) => somarMeses(m, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.escolherMesContainer}>
        <CampoDataHora
          valor={isoParaDate(inicioDoMes(mes))}
          modo="date"
          aoAlterar={(d) => setMes(dateParaIso(d).slice(0, 7))}
          textoExibido="Ir para um mês específico"
          icone="calendar-outline"
        />
      </View>

      <View style={styles.filtroClinicaContainer}>
        <TouchableOpacity
          style={[styles.clinicaChip, filtroClinica === null && styles.clinicaChipAtivoNeutro]}
          onPress={() => setFiltroClinica(null)}
        >
          <Text style={[styles.clinicaChipTexto, filtroClinica === null && styles.clinicaChipTextoAtivoNeutro]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.clinicaChip,
            { borderColor: COR_PARTICULAR },
            filtroClinica === ID_PARTICULAR && { backgroundColor: COR_PARTICULAR },
          ]}
          onPress={() => setFiltroClinica(ID_PARTICULAR)}
        >
          <Text style={[styles.clinicaChipTexto, filtroClinica === ID_PARTICULAR && styles.clinicaChipTextoAtivo]}>
            Particular
          </Text>
        </TouchableOpacity>
        {clinicas.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.clinicaChip, { borderColor: c.cor }, filtroClinica === c.id && { backgroundColor: c.cor }]}
            onPress={() => setFiltroClinica(c.id)}
          >
            <Text style={[styles.clinicaChipTexto, filtroClinica === c.id && styles.clinicaChipTextoAtivo]}>{c.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.resumoContainer}>
        <View style={styles.resumoCard}>
          <Text style={styles.resumoLabel}>Total no mês</Text>
          <Text style={styles.resumoValor}>{atendimentosFiltrados.length}</Text>
        </View>
        <View style={styles.resumoCard}>
          <Text style={[styles.resumoLabel, { color: theme.colors.success }]}>Realizados</Text>
          <Text style={[styles.resumoValor, { color: theme.colors.success }]}>{realizados}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.botaoPdf} onPress={baixarPdf} activeOpacity={0.7}>
        <Ionicons name="download-outline" size={16} color={theme.colors.primary} />
        <Text style={styles.botaoPdfTexto}>Baixar PDF do resumo</Text>
      </TouchableOpacity>

      <FlatList
        data={atendimentosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Ionicons name="document-text-outline" size={40} color={theme.colors.textTertiary} />
            <Text style={styles.vazio}>{carregando ? 'Carregando...' : 'Nenhum atendimento neste mês'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.faixaColorida, { backgroundColor: item.clinica_cor || COR_PARTICULAR }]} />
            <View style={styles.cardConteudo}>
              <View style={styles.dataHoraBox}>
                <Text style={styles.dataTexto}>{formatarDataCurta(item.data)}</Text>
                <Text style={styles.horaTexto}>{item.hora}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paciente}>{item.paciente_nome}</Text>
                <Text style={styles.detalhe}>
                  {item.clinica_nome || 'Particular'} · {item.procedimento || 'Consulta'}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusTexto,
                  item.status === 'realizado' && { color: theme.colors.success },
                  item.status === 'cancelado' && { color: theme.colors.danger },
                ]}
              >
                {STATUS_LABEL[item.status] || item.status}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  headerTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  navTitulo: { color: theme.colors.text, fontSize: 16, fontFamily: theme.font.medium, minWidth: 160, textAlign: 'center' },
  escolherMesContainer: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm },
  filtroClinicaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  clinicaChip: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clinicaChipAtivoNeutro: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  clinicaChipTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 12 },
  clinicaChipTextoAtivo: { color: '#fff' },
  clinicaChipTextoAtivoNeutro: { color: theme.colors.primary },
  botaoPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface,
  },
  botaoPdfTexto: { color: theme.colors.primary, fontFamily: theme.font.medium, fontSize: 13 },
  resumoContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  resumoCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  resumoLabel: { color: theme.colors.textSecondary, fontSize: 12, fontFamily: theme.font.regular, marginBottom: 4 },
  resumoValor: { color: theme.colors.text, fontSize: 18, fontFamily: theme.font.bold },
  vazioContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  vazio: { color: theme.colors.textSecondary, fontSize: 14, fontFamily: theme.font.medium },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    overflow: 'hidden',
  },
  faixaColorida: { width: 4 },
  cardConteudo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  dataHoraBox: { width: 48, alignItems: 'flex-start' },
  dataTexto: { color: theme.colors.text, fontFamily: theme.font.medium, fontSize: 13 },
  horaTexto: { color: theme.colors.textSecondary, fontFamily: theme.font.regular, fontSize: 12, marginTop: 1 },
  paciente: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.medium },
  detalhe: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: theme.font.regular, marginTop: 2 },
  statusTexto: { color: theme.colors.textTertiary, fontFamily: theme.font.medium, fontSize: 12 },
});
