Equivalent information could be relayed in different ways:

as json:
```
# an event
{
	@id: e1
	type: FailEvent
	source: node1
	ts: 11111
	output: ieoeoeoeoieoeo
}
```
as triples:
```
e1 type: FailEvent;
	source: node1;
	ts: 11111;
	output: ieoeoeoeoieoeo;
```
as quads in predicate-oriented way (RDF-star-ish syntax):
```
{node1 hasEvent FailEvent}
	ts: 11111;
	output: ieoeoeoeoieoeo;
```




















