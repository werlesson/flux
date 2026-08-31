import { Screen } from './screen';
export function RouteScreen({ title }: { title: string }) { return <Screen canGoBack scrollable={false} title={title}><></></Screen>; }
